import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    EventEmitterModule.forRoot({
        maxListeners: 30
    })
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
