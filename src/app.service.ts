import { BadRequestException, Injectable } from '@nestjs/common';
import * as ytdl from '@distube/ytdl-core';


@Injectable()
export class AppService {
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
}
