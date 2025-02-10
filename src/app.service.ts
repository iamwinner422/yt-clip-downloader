import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import * as ytdl from '@distube/ytdl-core';
import * as ffmpeg from 'fluent-ffmpeg';
import * as path from 'path';
import * as fs from 'fs/promises';
import { createReadStream } from 'fs';
import { VideoInfo, ytLinkRegex } from './utils';
const youtubeDl = require('youtube-dl-exec');
import { spawn } from "child_process";

//import statement didn't work
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath); // Set the path to the FFmpeg executable



const NODE_ENV = process.env.NODE_ENV;






@Injectable()
export class AppService {
    private readonly tempDir = path.join(__dirname, "./temp"); // Directory to store temporary files
    
    constructor() {
        this.ensureTempDir(this.tempDir); // Ensure the temp directory exists
    }


    getHello(): string {
        return "Hello World!";
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
    async getVideoInfo(ytLink: string) {
        if (!ytLink) throw new BadRequestException("Video URL is required");
        
        if (!ytLinkRegex.test(ytLink)) {
            throw new BadRequestException('Youtube url not invalid');
        }
        let videoInfo: VideoInfo = await youtubeDl(ytLink, {
            dumpSingleJson: true,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
            youtubeSkipDashManifest: true,
            cookies: "cookies.txt",
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        });

        return {
            title: videoInfo.title,
            duration: videoInfo.duration_string,
            thumbnail: videoInfo.thumbnail,
            channel: videoInfo.channel,
        };
    }

    /**
     * Downloads a clip from a YouTube video
     *
     * @param videoURL The URL of the video to download from
     * @param start The start time of the clip in seconds
     * @param duration The duration of the clip in seconds
     * @param res The response object to write the clip to
     *
     * @throws {BadRequestException} If no video URL is provided, or if the start time or duration are not valid positive numbers
     * @throws {InternalServerErrorException} If there is an error downloading the video or processing it with FFmpeg
     *
     * @returns {Promise<void>} A promise that resolves when the clip is downloaded and sent to the client
     */
    public async downloadClip(videoURL: string, start: number, duration: number, res: any) {
        const tempClipPath = path.join(this.tempDir, `temp_${Date.now()}.mp4`);
        let ffmpegCommand = null;

        // Basic validations
        if (!videoURL || start === undefined || duration === undefined) {
            throw new BadRequestException("Video URL, start time, and duration are required.");
        }

        if (!ytdl.validateURL(videoURL)) {
            throw new BadRequestException('Youtube url not invalid');
        }

        const startTime: number = Number(start);
        const durationTime: number = Number(duration) + 1; // Add 1 second to include the end of the clip

        if (isNaN(startTime) || isNaN(durationTime) || startTime < 0 || durationTime <= 1) {
            throw new BadRequestException("Start and duration must be valid.");
        }

        try {
            // Get video info
            let videoInfo = null; 
            const isProduction = NODE_ENV === 'production';
            const options = isProduction ? { agent: ytdl.createProxyAgent({ uri: process.env.YTDL_PROXY_AGENT }) } : {};

            videoInfo = await ytdl.getInfo(videoURL, options);

            const format = ytdl.chooseFormat(videoInfo.formats, {
                quality: "highest",
                filter: (format) => format.hasVideo && format.hasAudio,
            });

            if (!format) {
                throw new Error("Could not find a suitable video format.");
            }

            // Create video stream
            const videoStream = ytdl(videoURL, {
                format,
                begin: startTime * 1000,
                ...(isProduction && { agent: options.agent}) // Add proxy agent if in production
            });

            // Process video with FFmpeg
            await new Promise<void>((resolve, reject) => {
                ffmpegCommand = ffmpeg()
                    .input(videoStream)
                    .seekInput(startTime)
                    .duration(durationTime)
                    .outputOptions([
                        "-c:v copy",
                        "-c:a copy",
                        "-avoid_negative_ts make_zero",
                        "-movflags +faststart",
                        "-y",
                        "-q:v 1",
                        "-vf scale=iw:ih"
                    ])
                    .output(tempClipPath)
                    .on("start", (cmd) => console.log("FFmpeg started:", cmd))
                    .on("end", () => {
                        console.log("FFmpeg processing completed");
                        resolve();
                    })
                    .on("error", (err) => {
                        console.error("FFmpeg error:", err);
                        reject(
                            new Error(
                                `FFmpeg processing failed: ${err.message}`,
                            ),
                        );
                    })
                    .run();
            });

            // Stream the file to the client
            const clipName = `Clip-${startTime}_${Date.now()}.mp4`;
            res.setHeader(
                "Content-Disposition",
                `attachment; filename="${clipName}"`,
            );
            res.setHeader("Content-Type", "video/mp4");

            const clipStream = createReadStream(tempClipPath);
            clipStream.pipe(res);

            clipStream.on("close", async () => {
                console.log("Streaming completed, starting cleanup...");
                await this.cleanup(ffmpegCommand, videoStream, clipStream, tempClipPath);
            });

            res.on("error", async (err) => {
                console.error("Response error:", err);
                await this.cleanup(ffmpegCommand, videoStream, clipStream, tempClipPath);
            });
        } catch (err) {
            console.error("Download clip error:", err);
            this.handleError(res);
            throw new InternalServerErrorException("Failed to process the video clip.");
        }
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

        return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
    }

    /**
     * Ensures that the temporary directory exists by creating it if it does not.
     * If the directory already exists, no action is taken.
     *
     * @throws {Error} If there is an error creating the directory other than it already existing.
     * @returns {Promise<void>} A promise that resolves when the directory is ensured to exist.
     */
    private async ensureTempDir(tempDir: string): Promise<void> {
        try {
            await fs.mkdir(tempDir, { recursive: true });
            console.log(`Temp directory created or already exists: ${this.tempDir}`);
        } catch (err) {
            console.error("Error creating temp directory:", err);
            throw err;
        }
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
                ffmpegCommand.kill("SIGKILL");
            }
            if (videoStream && !videoStream.destroyed) {
                videoStream.destroy();
            }
            if (clipStream) {
                clipStream.close();
            }
            await fs.unlink(tempClipPath).catch(() => {});
        } catch (err) {
            console.error("Cleanup error:", err);
        }
    }

    
    /**
     * Handles an error by sending an Internal Server Error response if no response has been sent yet.
     *
     * @param res The response object to write the error response to.
     * @returns {void}
     */
    private handleError(res: any) {
        if (!res.headersSent) {
            res.status(500).send("Internal Server Error: Processing failed.");
        }
    }

}
