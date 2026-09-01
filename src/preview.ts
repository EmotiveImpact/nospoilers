/** Layout-only desk used when GitHub is not connected. Not a live install. */
export const PREVIEW_LOGIN = "emotive-impact"

export const PREVIEW_INSTALLATIONS = [
  { id: 1, account_login: PREVIEW_LOGIN, account_type: "User" },
]

export function previewRepos() {
  return [
    {
      id: 1,
      full_name: `${PREVIEW_LOGIN}/desktop`,
      private: true,
      html_url: `https://github.com/${PREVIEW_LOGIN}/desktop`,
      last_checked_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    },
  ]
}

export function previewAlerts() {
  const at = new Date()
  at.setHours(9, 14, 0, 0)
  return [
    {
      id: 1,
      kind: "repo_publicized",
      title: `${PREVIEW_LOGIN}/old-cli flipped to public`,
      body: "Visibility job finished in 400ms. No pack attached to this event.",
      findings: null,
      created_at: at.toISOString(),
      full_name: `${PREVIEW_LOGIN}/old-cli`,
    },
  ]
}

