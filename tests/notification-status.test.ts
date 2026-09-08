import {it,expect} from 'vitest';
import {notificationFailureMessage,notificationTestLabel} from '../src/watch/notification-status.ts';
it('provides bounded guidance without echoing unknown or sensitive provider strings',()=>{
 expect(notificationFailureMessage('credentials')).toContain('replace');
 expect(notificationFailureMessage('configuration')).toContain('not configured');
 expect(notificationFailureMessage('temporary')).toContain('retry progress');
 expect(notificationFailureMessage('https://hooks.slack.com/services/private')).not.toContain('hooks.slack.com');
 expect(notificationTestLabel('queued')).toContain('Waiting');
 expect(notificationTestLabel('sent')).toBe('Accepted by provider');
 expect(notificationTestLabel('cancelled')).toContain('Test stopped');
});
