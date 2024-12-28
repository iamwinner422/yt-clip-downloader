import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
    getHello(): string {
        return 'Hello World!';
    }


    async getInfo(videoURL: string) {
        if(!videoURL) throw new BadRequestException('Video URL is required');
    }
}
