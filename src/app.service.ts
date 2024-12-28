import { BadRequestException, Injectable } from '@nestjs/common';
import ytdl from 'ytdl-core';

@Injectable()
export class AppService {
    getHello(): string {
        return 'Hello World!';
    }


    async getInfo(videoURL: string) {
        if(!videoURL) throw new BadRequestException('Video URL is required');

        const videoInfo = await ytdl.getInfo(videoURL);
        return {
            title: videoInfo.videoDetails.title,
            duration: parseInt(videoInfo.videoDetails.lengthSeconds),
            thumbnail: videoInfo.videoDetails.thumbnails[0].url,
            channel: videoInfo.videoDetails.author
        }
    }
}
