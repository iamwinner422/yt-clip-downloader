import { HttpsProxyAgent } from 'https-proxy-agent';
import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import * as ytdl from '@distube/ytdl-core';
import * as ffmpeg from 'fluent-ffmpeg';
import * as path from 'path';
import * as fs from 'fs/promises';
import { createReadStream } from 'fs';
import { Agent } from 'http';


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
    async getVideoInfo(videoURL: string) {
        if (!videoURL) throw new BadRequestException("Video URL is required");
        
        let proxyAgent: any = undefined;
        
        if(NODE_ENV === 'production') {
            const proxyUrl = process.env.YTDL_PROXY_AGENT_URL
            proxyAgent =  ytdl.createProxyAgent({uri: proxyUrl});
            
        }
        console.log("po",proxyAgent)

        const videoInfo = proxyAgent ? await ytdl.getInfo(videoURL, {agent: proxyAgent}) :  await ytdl.getInfo(videoURL);
        
        return {
            title: videoInfo.videoDetails.title,
            duration: this.formatLengthSeconds(parseInt(videoInfo.videoDetails.lengthSeconds)),
            thumbnail: videoInfo.videoDetails.thumbnails[0].url,
            channel: videoInfo.videoDetails.author.name,
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

        const startTime: number = Number(start);
        const durationTime: number = Number(duration);

        if (isNaN(startTime) || isNaN(durationTime) || startTime < 0 || durationTime <= 0) {
            throw new BadRequestException("Start and duration must be valid positive numbers.");
        }

        try {
            // Get video info
            const videoInfo = await ytdl.getInfo(videoURL);
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


    private async getYoutubeCookies(){
        
    }
}
