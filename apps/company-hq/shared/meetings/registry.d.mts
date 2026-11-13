export interface MeetingRegistryParticipant { id: string; name: string; role: string; supervisorName: string; lifecycle: string; operation: string; qualifiedForLiveMeeting: boolean; source: { id: string; version: string; url?: string } }
export function parseMeetingRegistry(markdown: string, source: MeetingRegistryParticipant['source']): MeetingRegistryParticipant[]
export const demonstrationRegistry: MeetingRegistryParticipant[]
