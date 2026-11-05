import type { HqAgentSnapshot } from '../../shared/types/agents'
import type { HqWorkActivity } from '@building-suit/ui/types/hqAgentsPresentation'
import { hqObservedActivity } from './hqAgentPresence.ts'

/** Preserve actual job ownership; a task's assignee is not its current reviewer. */
export function hqWorkActivity(snapshot: HqAgentSnapshot, online: boolean, now: number): HqWorkActivity[] {
  return snapshot.jobs.filter(job => job.status === 'working' || job.status === 'queued')
    .sort((a, b) => Number(b.status === 'working') - Number(a.status === 'working') || Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .map((job): HqWorkActivity => {
      const agent = snapshot.agents.find(item => item.id === job.agentId)
      const taskIds = new Set(snapshot.messages.filter(message => message.taskId && message.replyTo === job.founderMessageId).map(message => message.taskId))
      // Ambiguous/missing transcript coverage must never link to an arbitrary task.
      const task = taskIds.size === 1 ? snapshot.tasks?.find(item => taskIds.has(item.id)) : undefined
      const confirmed = agent && hqObservedActivity(agent, online, now) === 'working'
        && (agent.taskId === job.id || task && agent.taskId === task.id)
      return { id: job.id, agentId: job.agentId, agentName: agent?.name ?? job.agentId,
        stage: job.kind ?? 'unknown', state: job.status === 'queued' ? 'queued' : confirmed ? 'working' : 'unconfirmed',
        createdAt: job.createdAt, startedAt: job.startedAt,
        ...(task ? { taskId: task.id, taskTitle: task.title } : {}),
      }
    })
}
