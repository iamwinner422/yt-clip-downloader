import { Controller, Get, Param, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiParam, ApiResponse } from '@nestjs/swagger';
import { Response as res } from 'express';

@Controller()
export class AppController {
    constructor(private readonly appService: AppService) {}

    @Get('/hello')
    getHello(): string {
        return this.appService.getHello();
    }


    @Get('/video-info/:videoURL')
    @ApiResponse({ status: 200, schema: { 
        type: 'object', 
        properties: { 
            title: { type: 'string' }, 
            duration: { type: 'string' }, 
            thumbnail: { type: 'string' }, 
            channel: { type: 'string' } 
        } 
    }})
    async getVideoInfo(@Param('videoURL') videoURL: string) {
        return this.appService.getVideoInfo(videoURL);
    }


    @Get('/download-clip/:videoURL/:start/:duration')
    @ApiResponse({ status: 200, type: 'file' })
    async downloadClip(@Param('videoURL') videoURL: string, @Param('start') start: number, @Param('duration') duration: number, @Res() res: res ) {
        return this.appService.downloadClip(videoURL, start, duration, res);
    }
}
