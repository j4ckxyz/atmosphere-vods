export interface StreamVideoRecord {
  uri: string
  cid: string
  value: {
    $type: 'place.stream.video'
    title: string
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
  title: string
  creatorDid: string
  creatorName: string
  creatorHandle?: string
  durationNs: number
  createdAt: string
  sourceRef?: string
  sourceMimeType?: string
}
