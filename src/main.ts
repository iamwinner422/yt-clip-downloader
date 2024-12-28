import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';


async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    const config = new DocumentBuilder()
        .setTitle('YT Clip Downloader')
        .setDescription('Youtube Clip Downloader allows you to download specific video clips from YouTube by providing a video URL, start time, and clip duration.')
        .setVersion('1.0')
        .build();

    const documentFactory = () => SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('/', app, documentFactory);

    await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
