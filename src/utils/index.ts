export const ytLinkRegex = /^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube\.com|youtu.be))(\/(?:[\w\-]+\?v=|embed\/|v\/)?)([\w\-]+)(\S+)?$/


export interface VideoInfo {
    title: string;
    duration_string: string;
    thumbnail: string;
    channel: string;
}