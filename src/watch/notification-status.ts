export function notificationFailureMessage(code: string | null | undefined): string {
 switch(code){
  case 'configuration':return 'Sending is not configured on this host. Contact your workspace administrator.';
  case 'credentials':return 'Check or replace the destination credentials, then send a new test.';
  case 'rejected':return 'The provider rejected this message. Check the destination settings before testing again.';
  case 'temporary':return 'The provider was temporarily unavailable. Check the latest test status for retry progress.';
  default:return 'Delivery failed. Check the destination settings and send a test; private provider details are not displayed.';
 }
}
export function notificationTestLabel(status: string | null | undefined): string {
 switch(status){
  case 'queued':return 'Waiting for delivery or a scheduled retry';
  case 'running':return 'Delivery in progress';
  case 'sent':return 'Accepted by provider';
  case 'failed':return 'Test failed — review delivery history';
  case 'cancelled':return 'Test stopped — check workspace access, plan or destination changes';
  default:return 'Not requested';
 }
}
