CREATE INDEX "Event_startTime_idx" ON "Event"("startTime");
CREATE INDEX "Event_isLive_startTime_idx" ON "Event"("isLive", "startTime");
CREATE INDEX "Event_isPublished_startTime_idx" ON "Event"("isPublished", "startTime");
CREATE INDEX "Event_muxAssetId_startTime_idx" ON "Event"("muxAssetId", "startTime");

CREATE UNIQUE INDEX "ContentReaction_profileId_eventId_type_key"
ON "ContentReaction"("profileId", "eventId", "type");

CREATE UNIQUE INDEX "ContentReaction_profileId_youtubeVideoId_type_key"
ON "ContentReaction"("profileId", "youtubeVideoId", "type");
