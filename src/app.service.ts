import { BadRequestException, Injectable, StreamableFile } from '@nestjs/common';
import * as ytdl from '@distube/ytdl-core';
import * as ffmpeg from 'fluent-ffmpeg';
import * as path from 'path';
import * as fs from 'fs/promises';
import { createReadStream } from 'fs';
import ffmpegPath from 'ffmpeg-static';

import { Response as res } from 'express';

ffmpeg.setFfmpegPath(ffmpegPath);


@Injectable()
export class AppService {
    private readonly tempDir = path.join(__dirname, '../../temp'); // Directory to store temporary files
    
    constructor(){
        this.ensureTempDir(); // Ensure the temp directory exists

    }
    
    
    
    getHello(): string {
        return 'Hello World!';
    }


    /**
     * Retrieves information about a video from YouTube
     *
     * @param videoURL The URL of the video to retrieve information about
     *
     * @throws {BadRequestException} If no video URL is provided
     *
     * @returns {Promise<{title: string, duration: number, thumbnail: string, channel: string}>}
     * A promise that resolves with an object containing the video's title, duration in seconds, thumbnail URL, and channel name
     */
    async getVideoInfo(videoURL: string) {
        if(!videoURL) throw new BadRequestException('Video URL is required');

        const videoInfo = await ytdl.getInfo(videoURL);
        return {
            title: videoInfo.videoDetails.title,
            duration: this.formatLengthSeconds(parseInt(videoInfo.videoDetails.lengthSeconds)),
            thumbnail: videoInfo.videoDetails.thumbnails[0].url,
            channel: videoInfo.videoDetails.author.name
        }
    }

    async downloadClip(videoURL: string, start: number, duration: number, res: res) {
        const tempClipPath: string = path.join(this.tempDir, `temp_${Date.now()}.mp4`);

        let fileStream = null;
        let ffmpegCommand = null;

        // Basic Validations
        if(!videoURL || !start || !duration) throw new BadRequestException('Video URL, start time, and duration are required');

        //Parsing start and duration
        const startTime: number = Number(start);
        const durationTime: number = Number(duration);

        // Validating start and duration
        if (isNaN(startTime) || isNaN(durationTime) || startTime < 0 || durationTime <= 0) {
            throw new BadRequestException('Start and duration must be valid positive numbers');
        }

        // Get video info
        const videoInfo = await ytdl.getInfo(videoURL);
        

        const format = ytdl.chooseFormat(videoInfo.formats, {
            quality: 'highest',
            filter: (format) => format.hasVideo && format.hasAudio,
        });

        if (!format) {
            throw new Error('Could not find a suitable video format.');
        }

        // Creating video stream
        const videoStream = ytdl(videoURL, { format, begin: startTime * 1000}); // Convert start time to milliseconds
        
        // Processing with ffmpeg
        await new Promise((resolve, reject) => {
            ffmpegCommand = ffmpeg()
                .input(videoStream)
                .seekInput(startTime)
                .duration(durationTime)
                .outputOptions([
                    '-c:v copy',
                    '-c:a copy',
                    '-avoid_negative_ts make_zero',
                    '-movflags +faststart',
                    '-y',
                ])
                .output(tempClipPath)
                .on('start', () => console.log('FFmpeg processing started...'))
                .on('end', () => {
                    console.log('FFmpeg processing completed');
                    resolve(tempClipPath);
                })
                .on('error', (err) => {
                    console.error('FFmpeg error:', err);
                    reject(new Error(`FFmpeg processing failed: ${err.message}`));
                })
                .run();
            
            // Create a clip name
            const clipName: string = `Clip-${startTime}_${Date.now()}.mp4`;

            res.setHeader('Content-Disposition', `attachment; filename="${clipName}"`);
            res.setHeader('Content-Type', 'video/mp4');
            
            const clipStream = createReadStream(tempClipPath);
            clipStream.pipe(res);

            // Nettoyage après envoi
            res.on('finish', async () => {
                await this.cleanup(ffmpegCommand, videoStream, clipStream, tempClipPath);      
            });

            res.on('error', async () => {
                await this.cleanup(ffmpegCommand, videoStream, clipStream, tempClipPath); 
            });
        });
    }



    /**
     * Converts a duration from seconds to a string formatted as "minutes:seconds".
     *
     * @param lengthSeconds The duration in seconds to format.
     * @returns A string representing the duration in "minutes:seconds" format.
    */
    private formatLengthSeconds(lengthSeconds: number): string {
        const minutes = Math.floor(lengthSeconds / 60);
        const seconds = lengthSeconds % 60;

        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }

    /**
     * Ensures that the temporary directory exists by creating it if it does not.
     * If the directory already exists, no action is taken.
     *
     * @throws {Error} If there is an error creating the directory other than it already existing.
     * @returns {Promise<void>} A promise that resolves when the directory is ensured to exist.
    */
    private async ensureTempDir(): Promise<void> {
        await fs.mkdir(this.tempDir, { recursive: true }).catch((err) => {
            if (err.code !== 'EEXIST') {
                console.error('Error creating temp directory:', err);
                throw err;
            }
        });
    }

    /**
     * Cleans up resources used by the clip download operation.
     *
     * Cleans up the FFmpeg command if it is running, the video stream if it is not destroyed, the clip stream, and the temporary clip file.
     *
     * @param ffmpegCommand The FFmpeg command to clean up if it is running.
     * @param videoStream The video stream to clean up if it is not destroyed.
     * @param clipStream The clip stream to clean up.
     * @param tempClipPath The path to the temporary clip file to clean up.
     * @throws {Error} If there is an error cleaning up the resources.
     * @returns {Promise<void>} A promise that resolves when the resources are cleaned up.
     */
    private async cleanup(ffmpegCommand: any, videoStream: any, clipStream: any, tempClipPath: string) {
        try {
            if (ffmpegCommand) {
                ffmpegCommand.kill('SIGKILL');
            }
            if (videoStream && !videoStream.destroyed) {
                videoStream.destroy();
            }
            if (clipStream) {
                clipStream.close();
            }
            await fs.unlink(tempClipPath).catch(() => {});
        } catch (err) {
            console.error('Cleanup error:', err);
        }
    }
    
}
