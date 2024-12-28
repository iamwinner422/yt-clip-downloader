import { Controller, Get, Param } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiParam, ApiResponse } from '@nestjs/swagger';

@Controller()
export class AppController {
    constructor(private readonly appService: AppService) {}

    @Get('/hello')
    getHello(): string {
        return this.appService.getHello();
    }


    @Get('/video-info/:videoURL')
    @ApiParam({ name: 'videoURL', type: String, required: true })
    @ApiResponse({ status: 200, schema: { 
        type: 'object', 
        properties: { 
            title: { type: 'string' }, 
            duration: { type: 'number' }, 
            thumbnail: { type: 'string' }, 
            channel: { type: 'string' } 
        } 
    }})
    async getVideoInfo(@Param('videoURL') videoURL: string) {
        return this.appService.getInfo(videoURL);
    }
}
