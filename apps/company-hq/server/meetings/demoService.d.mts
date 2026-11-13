import type { MeetingRecord } from '../../shared/meetings/domain.mjs'
import type { MeetingRegistryParticipant } from '../../shared/meetings/registry.mjs'
import type { SyntheticMeetingRepository } from './repository.mjs'
export interface DemoMeetingSnapshot { mode: 'demonstration'; registry: MeetingRegistryParticipant[]; record: MeetingRecord | null; receipts: ReturnType<SyntheticMeetingRepository['jobs']>; reports: ReturnType<SyntheticMeetingRepository['report']> }
export function demoSnapshot(filename: string, owner: string, meetingId?: string): DemoMeetingSnapshot
export function demoCommand(filename: string, owner: string, input: { requestId: string; meetingId?: string; command: object }): DemoMeetingSnapshot
