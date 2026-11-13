// Parse only fixed launch-result cues. Activity-manager output can contain
// intent data; neither that output nor arbitrary errors belong in receipts.
export function androidLaunchObservation({attempted, completed, exitCode, output, errorOutput}) {
  const available = typeof output === 'string'
  const errorAvailable = typeof errorOutput === 'string'
  const bounded = (available ? output.slice(0, 8192) : '') + '\n' + (errorAvailable ? errorOutput.slice(0, 8192) : '')
  return {
    attempted: attempted === true,
    commandCompleted: completed === true,
    exitCode: Number.isInteger(exitCode) && exitCode >= 0 && exitCode <= 255 ? exitCode : null,
    outputAvailable: available || errorAvailable,
    outputTruncated: (available && output.length > 8192) || (errorAvailable && errorOutput.length > 8192),
    startReported: /^Starting: Intent\b/m.test(bounded),
    activityMissing: /^(?:Error type 3|Error: Activity class .* does not exist\.)$/m.test(bounded),
    permissionDenied: /^(?:Security exception:|java\.lang\.SecurityException:|Permission Denial:)/m.test(bounded),
    intentUnresolved: /^Error: Activity not started, unable to resolve Intent\b/m.test(bounded),
    existingInstanceReported: /^Warning: Activity not started, (?:intent has been delivered to currently running top-most instance|its current task has been brought to the front)/m.test(bounded),
    errorReported: /^(?:Error(?: type \d+|:)|Security exception:|java\.lang\.SecurityException:|Permission Denial:)/m.test(bounded),
  }
}
