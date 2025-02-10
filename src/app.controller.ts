import { Controller, Get, Query, Res } from '@nestjs/common';
import { AppService } from './app.service';
import {ApiResponse } from '@nestjs/swagger';
import { Response as res } from 'express';

@Controller()
export class AppController {
    constructor(private readonly appService: AppService) {}

    @Get('/hello')
    getHello(): string {
        return this.appService.getHello();
    }


    @Get('/info')
    @ApiResponse({ status: 200, schema: { 
        type: 'object', 
        properties: { 
            title: { type: 'string' }, 
            duration: { type: 'string' }, 
            durationSeconds: { type: 'number' }, 
            thumbnail: { type: 'string' }, 
            channel: { type: 'string' } 
        } 
    }})

    async getVideoInfo(@Query('ytLink') ytLink: string) {
        return this.appService.getVideoInfo(ytLink);
    }


    @Get('/download-clip')
    @ApiResponse({ status: 200, type: 'file' })
    async downloadClip(@Query('videoURL') videoURL: string, @Query('start') start: number, @Query('duration') duration: number, @Res() res: res ) {
        return this.appService.downloadClip(videoURL, start, duration, res);
    }
}
