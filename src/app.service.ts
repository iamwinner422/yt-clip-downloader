import { BadRequestException, Injectable } from '@nestjs/common';
import * as ytdl from '@distube/ytdl-core';
import * as ffmpeg from 'fluent-ffmpeg';
import * as path from 'path';
import * as fs from 'fs/promises';
import { createReadStream } from 'fs';
import ffmpegPath from 'ffmpeg-static';



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

    async downloadClip(videoURL: string, start: number, duration: number) {
        const tempFilePath: string = path.join(this.tempDir, `temp_${Date.now()}.mp4`);
        let videoStream = null;
        let fileStream = null;
        let ffmpegCommand = null;


        if(!videoURL || !start || !duration) throw new BadRequestException('Video URL, start time, and duration are required');

        const startTime: number = Number(start);
        const durationTime: number = Number(duration);


        if (isNaN(startTime) || isNaN(durationTime) || startTime < 0 || durationTime <= 0) {
            throw new BadRequestException('Start and duration must be valid positive numbers');
        }

        const videoInfo = await ytdl.getInfo(videoURL);
        const videoTitle: string = `Clip-${start}_${Date.now()}`;

        const format = ytdl.chooseFormat(videoInfo.formats, {
            quality: 'highest',
            filter: (format) => format.hasVideo && format.hasAudio,
        });

        if (!format) {
            throw new Error('Could not find a suitable video format.');
        }

        // Creating video stream
        videoStream = ytdl(videoURL, { format, begin: startTime * 1000}); // Convert start time to milliseconds
        
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
     * Retries the given operation up to the given number of times, waiting a specified amount of time between retries.
     *
     * @param operation The operation to retry. Should return a Promise.
     * @param maxRetries The number of times to retry the operation.
     * @param delay The amount of time, in milliseconds, to wait between retries. Defaults to 1000.
     * @throws {Error} If the operation fails after the maximum number of retries.
     * @returns {Promise<void>} A promise that resolves when the operation is successful.
     */
    private async retryOperation(operation, maxRetries, delay = 1000): Promise<void> {
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await operation();
            } catch (error) {
                if (i === maxRetries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
            }
        }
    }

    private sanitizeFileName(fileName: string): string {
        return fileName.replace(/[^a-zA-Z0-9]/g, '_');
    }
    
}
