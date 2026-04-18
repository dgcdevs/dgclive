-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "youtubeVideoId" TEXT;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "muxLiveStreamId" TEXT,
ADD COLUMN     "thumbnailUrl" TEXT;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_youtubeVideoId_fkey" FOREIGN KEY ("youtubeVideoId") REFERENCES "YouTubeVideo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
