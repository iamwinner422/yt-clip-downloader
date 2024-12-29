# Youtube Clip Downloader API

This API allows you to download specific segments of YouTube videos by specifying a start timestamp and duration. It's based on [ytdl-core](https://github.com/distubejs/ytdl-core) (DisTube version), [fluent-ffmep](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg), [ffmpeg-static](https://github.com/eugeneware/ffmpeg-static) and [Nest](https://nestjs.com) Framework

## Demo link:
https://yt-clip-downloader.koyeb.app

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run dev

# production mode
$ npm run start:prod
```

## Usage
The Swagger definition for this API is available [here](https://yt-clip-downloader.koyeb.app)
### Download a clip
1. **Endpoint**: ```GET /download-clip```

2. **Query Parameters**:

| Parameter |  Type  |        Description       | Required |
|-----------|--------|--------------------------|----------|
| videoURL  | string | YouTube video URL        |   yes    |
|start      | number | Start time in seconds    |   yes    |
|duration   | number | Clip duration in seconds |   yes    |

3. **Example**:
```
curl -X 'GET' \
  'http://localhost:3000/download-clip?videoURL=https://youtu.be/dQw4w9WgXcQ&start=60&duration=30' \
  -H 'accept: application/json'
```

### Get Video Informations
1. **Endpoint**: ```GET /video-infos```

2. **Query Parameters**:

| Parameter |  Type  |        Description       | Required |
|-----------|--------|--------------------------|----------|
| videoURL  | string | YouTube video URL        |   yes    |

3. **Example**:
```
curl -X 'GET' \
  'http://localhost:3000/video-info?videoURL=https://youtu.be/dQw4w9WgXcQ' \
  -H 'accept: application/json'
```
