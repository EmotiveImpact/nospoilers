/** Read-only source entitlement projection. Once mapped, the workspace's organisation
 * owns entitlements; an old standalone installation trial is never a fallback. */
export const sourceBillingSql=`
 SELECT i.id AS installation_id,
   CASE WHEN c.installation_id IS NULL THEN legacy.installation_id WHEN o.legacy_personal_user_id IS NOT NULL THEN NULL ELSE account.installation_id END AS billing_installation_id,
   COALESCE(w.archived_at IS NOT NULL,false) AS archived,
   o.legacy_personal_user_id AS billing_user_id,
   CASE WHEN c.installation_id IS NULL THEN legacy.organization_id ELSE o.id END AS organization_id,
   CASE WHEN c.installation_id IS NULL THEN legacy.plan WHEN o.legacy_personal_user_id IS NOT NULL THEN u.plan ELSE account.plan END AS plan,
   CASE WHEN c.installation_id IS NULL THEN legacy.trial_ends_at WHEN o.legacy_personal_user_id IS NOT NULL THEN u.trial_ends_at ELSE account.trial_ends_at END AS trial_ends_at,
   CASE WHEN c.installation_id IS NULL THEN legacy.retention_days WHEN o.legacy_personal_user_id IS NOT NULL THEN 90 ELSE account.retention_days END AS retention_days
 FROM installations i
 LEFT JOIN product_workspace_installations c ON c.installation_id=i.id
 LEFT JOIN product_workspaces w ON w.id=c.workspace_id
 LEFT JOIN product_organizations o ON o.id=w.organization_id
 LEFT JOIN billing_accounts account ON account.organization_id=o.id
 LEFT JOIN users u ON u.id=o.legacy_personal_user_id
 LEFT JOIN billing_accounts legacy ON legacy.installation_id=i.id
`;
