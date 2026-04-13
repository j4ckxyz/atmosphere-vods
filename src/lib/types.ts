export interface StreamVideoRecord {
  uri: string
  cid: string
  value: {
    $type: 'place.stream.video'
    title: string
    description?: string
    creator: string
    duration: number
    createdAt: string
    source?: {
      $type?: string
      ref?: string
      mimeType?: string
      size?: number
      start?: number
      end?: number
    }
    livestream?: {
      uri?: string
    }
  }
}

export interface ListRecordsResponse {
  records: StreamVideoRecord[]
  cursor?: string
}

export interface GetRecordResponse {
  uri: string
  cid: string
  value: StreamVideoRecord['value']
}

export interface ListReposByCollectionResponse {
  repos: Array<{
    did: string
  }>
  cursor?: string
}

export interface PlcDidDocument {
  service?: Array<{
    id?: string
    type?: string
    serviceEndpoint?: string
  }>
}

export interface ActorProfile {
  did: string
  handle?: string
  displayName?: string
  avatar?: string
}

export interface AppTalk {
  uri: string
  cid: string
  sourceRepoDid: string
  title: string
  description?: string
  creatorDid: string
  creatorName: string
  creatorHandle?: string
  durationNs: number
  createdAt: string
  sourceRef?: string
  sourceMimeType?: string
  taxonomyGroup?: string
  taxonomyTags?: string[]
  taxonomyTopics?: string[]
  taxonomyKeywords?: string[]
}

export interface IonosphereTalkRecord {
  uri: string
  cid: string
  value: {
    $type: 'tv.ionosphere.talk'
    title?: string
    room?: string
    track?: string
    category?: string
    eventUri?: string
    startsAt?: string
    endsAt?: string
    speakerUris?: string[]
    videoUri?: string
  }
}

export interface IonosphereConceptRecord {
  uri: string
  cid: string
  value: {
    $type: 'tv.ionosphere.concept'
    name?: string
    aliases?: string[]
  }
}

export interface IonosphereAnnotationRecord {
  uri: string
  cid: string
  value: {
    $type: 'tv.ionosphere.annotation'
    talkUri?: string
    conceptUri?: string
  }
}

export interface IonosphereSpeakerRecord {
  uri: string
  cid: string
  value: {
    $type: 'tv.ionosphere.speaker'
    name?: string
    handle?: string
    did?: string
  }
}

export interface IonosphereEnrichment {
  room?: string
  scheduledAt?: string
  track?: string
  topics: string[]
  speakerName?: string
  speakerHandle?: string
  speakerAvatar?: string
}

export interface IonosphereEnrichmentResult {
  byVodUri: Map<string, IonosphereEnrichment>
  allTopics: string[]
}
