import { Controller, Get, Param, Query, Res } from '@nestjs/common';
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


    @Get('/video-info')
    @ApiResponse({ status: 200, schema: { 
        type: 'object', 
        properties: { 
            title: { type: 'string' }, 
            duration: { type: 'string' }, 
            thumbnail: { type: 'string' }, 
            channel: { type: 'string' } 
        } 
    }})

    async getVideoInfo(@Query('videoURL') videoURL: string) {
        return this.appService.getVideoInfo(videoURL);
    }


    @Get('/download-clip')
    @ApiResponse({ status: 200, type: 'file' })
    async downloadClip(@Query('videoURL') videoURL: string, @Query('start') start: number, @Query('duration') duration: number, @Res() res: res ) {
        return this.appService.downloadClip(videoURL, start, duration, res);
    }
}
