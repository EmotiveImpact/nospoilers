import { Field, Input, Label, Textarea } from "@headlessui/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useCallback, useState } from "react"

export type DisclosureState =
  | "signal"
  | "verifying"
  | "verified"
  | "false_positive"
  | "duplicate"

export type DisclosureConversion = "none" | "trial" | "paid" | "declined"

export type VendorChannel = "security_email" | "form" | "security_txt" | "platform"

export type FindingCategory =
  | "sourcemap"
  | "environment"
  | "credential"
  | "source"
  | "git"
  | "archive"
  | "backup"
  | "database"
  | "crash"
  | "document"
  | "agent"
  | "debug"
  | "network"
  | "size"
  | "other"

const FINDING_CATEGORY_OPTIONS: { value: FindingCategory; label: string }[] = [
  { value: "sourcemap", label: "sourcemap" },
  { value: "environment", label: "environment file" },
  { value: "credential", label: "credential" },
  { value: "source", label: "source" },
  { value: "git", label: "git history" },
  { value: "archive", label: "archive" },
  { value: "backup", label: "backup" },
  { value: "database", label: "database dump" },
  { value: "crash", label: "crash dump" },
  { value: "document", label: "internal document" },
  { value: "agent", label: "agent context" },
  { value: "debug", label: "debug" },
  { value: "network", label: "internal network" },
  { value: "size", label: "size" },
  { value: "other", label: "other" },
]

export type VendorReplyChannel = VendorChannel | "other"

export type DisclosureReviewState = "none" | "pending" | "approved" | "rejected"

export type DisclosureSummary = {
  id: number
  prospectId: number
  state: DisclosureState
  conversion: DisclosureConversion
  deadlineMissed: boolean
  acknowledgedAt: string | null
  fixVersion: string | null
  lastRescanAt: string | null
  fingerprintCount: number
  findingCategory?: FindingCategory
  artifactSha256?: string | null
  hasReproducibilitySteps?: boolean
  vendorChannel?: VendorChannel | null
  assignee?: string | null
  reviewState?: DisclosureReviewState
}

export type DuplicateMatch = {
  caseId: number
  prospectId: number
  owner: string
  repo: string
  packageName: string | null
  state: DisclosureState
  reasons: Array<"owner_repo" | "organization" | "package" | "fingerprint" | "domain">
}

export type DncMatch = {
  id: number
  reasons: Array<"owner_repo" | "package" | "contact" | "domain">
  owner: string | null
  repo: string | null
  packageName: string | null
  contact: string | null
  reason: string
}

type DisclosureTemplate = {
  id: number
  name: string
  subject: string
  body: string
}

type Checklist = {
  public_artifact: boolean
  reproduced: boolean
  fingerprints_recorded: boolean
  no_secret_values: boolean
  contact_or_policy: boolean
}

type DisclosureCase = {
  id: number
  prospectId: number
  state: DisclosureState
  checklist: Checklist
  fingerprints: string[]
  findingCategory: FindingCategory
  artifact: {
    url: string
    name: string
    version: string | null
    bytes: number | null
    sha256: string | null
    sha512: string | null
  }
  reproducibilitySteps: string | null
  duplicateLinks: Array<{
    otherCaseId: number
    owner: string
    repo: string
    packageName: string | null
    reasons: string[]
  }>
  organization: {
    githubOwner: string
    domains: { host: string; source: string }[]
  } | null
  securityContact: string | null
  policyUrl: string | null
  notes: string | null
  notesExpired: boolean
  notesExpiresAt: string | null
  draftSubject: string | null
  draftBody: string | null
  sent: false
  acknowledgementNote: string | null
  acknowledgedAt: string | null
  deadlineAt: string | null
  deadlineMissed: boolean
  conversion: DisclosureConversion
  fixVersion: string | null
  lastRescanAt: string | null
  vendorChannel: VendorChannel | null
  outcomeCredit: string | null
  outcomeCve: string | null
  outcomeNotes: string | null
  assignee: string | null
  reviewState: DisclosureReviewState
  reviewNote: string | null
  sla: {
    openedAt: string
    verifiedAt: string | null
    acknowledgedAt: string | null
    timeToVerifyMs: number | null
    timeToAckMs: number | null
  }
  replies: {
    id: number
    channel: VendorReplyChannel
    summary: string
    receivedAt: string
  }[]
  attachments: {
    id: number
    filename: string
    mediaType: string
    byteLength: number
    expired: boolean
  }[]
  events: { id: number; action: string; actor: string; summary: string; createdAt: string }[]
}

const CHECKS: { key: keyof Checklist; label: string }[] = [
  { key: "public_artifact", label: "Public artifact confirmed" },
  { key: "reproduced", label: "Finding reproduced" },
  { key: "fingerprints_recorded", label: "Fingerprints recorded" },
  { key: "no_secret_values", label: "No secret values stored" },
  { key: "contact_or_policy", label: "Contact or policy on file" },
]

type DeskDestination = {
  id: number
  kind: "webhook" | "jira"
  host: string
  projectKey: string | null
}

type Props = {
  prospectId: number
  owner: string
  repo: string
  destinations: DeskDestination[]
  summary: DisclosureSummary | null
  request: <T>(url: string, options?: RequestInit) => Promise<T>
  token?: string
  onChanged: () => Promise<void>
}

export function DisclosureCasePanel({
  prospectId,
  owner,
  repo,
  destinations,
  summary,
  request,
  token,
  onChanged,
}: Props) {
  const [open, setOpen] = useState(false)
  const [desk, setDesk] = useState<DisclosureCase | null>(null)
  const [duplicates, setDuplicates] = useState<DuplicateMatch[] | null>(null)
  const [contact, setContact] = useState("")
  const [policyUrl, setPolicyUrl] = useState("")
  const [notes, setNotes] = useState("")
  const [reproSteps, setReproSteps] = useState("")
  const [ackNote, setAckNote] = useState("")
  const [fixVersion, setFixVersion] = useState("")
  const [deadline, setDeadline] = useState("")
  const [conversion, setConversion] = useState<DisclosureConversion>("none")
  const [findingCategory, setFindingCategory] = useState<FindingCategory>("other")
  const [vendorChannel, setVendorChannel] = useState<VendorChannel | "">("")
  const [outcomeCredit, setOutcomeCredit] = useState("")
  const [outcomeCve, setOutcomeCve] = useState("")
  const [outcomeNotes, setOutcomeNotes] = useState("")
  const [templates, setTemplates] = useState<DisclosureTemplate[]>([])
  const [templateId, setTemplateId] = useState<number | "">("")
  const [previewMeta, setPreviewMeta] = useState<{ recipients: string[]; channel: string | null } | null>(
    null,
  )
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dnc, setDnc] = useState<DncMatch[] | null>(null)
  const [assignee, setAssignee] = useState("")
  const [reviewNote, setReviewNote] = useState("")
  const [replyChannel, setReplyChannel] = useState<VendorReplyChannel>("security_email")
  const [replySummary, setReplySummary] = useState("")
  const [attachmentName, setAttachmentName] = useState("vendor-note.txt")
  const [attachmentBytes, setAttachmentBytes] = useState<string>("")
  const [notifyId, setNotifyId] = useState<number | "">("")
  const [notifyConfirm, setNotifyConfirm] = useState("")

  const loadCase = useCallback(async () => {
    try {
      const body = await request<{ case: DisclosureCase }>(
        `/api/internal/prospects/${prospectId}/disclosure`,
      )
      setDesk(body.case)
      setContact(body.case.securityContact ?? "")
      setPolicyUrl(body.case.policyUrl ?? "")
      setNotes(body.case.notes ?? "")
      setReproSteps(body.case.reproducibilitySteps ?? "")
      setAckNote(body.case.acknowledgementNote ?? "")
      setFixVersion(body.case.fixVersion ?? "")
      setDeadline(body.case.deadlineAt ? body.case.deadlineAt.slice(0, 16) : "")
      setConversion(body.case.conversion)
      setFindingCategory(body.case.findingCategory)
      setVendorChannel(body.case.vendorChannel ?? "")
      setOutcomeCredit(body.case.outcomeCredit ?? "")
      setOutcomeCve(body.case.outcomeCve ?? "")
      setOutcomeNotes(body.case.outcomeNotes ?? "")
      setAssignee(body.case.assignee ?? "")
      setReviewNote(body.case.reviewNote ?? "")
      setDuplicates(null)
      setDnc(null)
    } catch (err) {
      if (err instanceof Error && err.message === "No disclosure case yet.") {
        setDesk(null)
        return
      }
      throw err
    }
  }, [prospectId, request])

  async function toggleOpen() {
    const next = !open
    setOpen(next)
    if (!next) return
    try {
      await loadCase()
      const listed = await request<{ templates: DisclosureTemplate[] }>(
        "/api/internal/disclosure/templates",
      )
      setTemplates(listed.templates)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the case.")
    }
  }

  async function createCase(confirmDuplicate = false, researchOnly = false) {
    setBusy("create")
    setError(null)
    try {
      const created = await request<{ case: DisclosureCase; error?: string; duplicates?: DuplicateMatch[] }>(
        `/api/internal/prospects/${prospectId}/disclosure`,
        { method: "POST", body: JSON.stringify({ confirmDuplicate, researchOnly }) },
      )
      setDesk(created.case)
      setDuplicates(null)
      setDnc(null)
      await onChanged()
    } catch (err) {
      const failed = err as Error & { duplicates?: DuplicateMatch[]; dnc?: DncMatch[] }
      if (failed.dnc?.length) {
        setDnc(failed.dnc)
        setError(failed.message)
      } else if (failed.duplicates?.length) {
        setDuplicates(failed.duplicates)
        setError(failed.message)
      } else {
        setError(failed.message)
      }
    } finally {
      setBusy(null)
    }
  }

  async function patch(body: Record<string, unknown>) {
    setBusy("patch")
    setError(null)
    try {
      const updated = await request<{ case: DisclosureCase }>(
        `/api/internal/prospects/${prospectId}/disclosure`,
        { method: "PATCH", body: JSON.stringify(body) },
      )
      setDesk(updated.case)
      await onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the case.")
    } finally {
      setBusy(null)
    }
  }

  async function preview() {
    setBusy("preview")
    setError(null)
    try {
      const draft = await request<{
        subject: string
        body: string
        sent: false
        recipients: string[]
        channel: string | null
        case: DisclosureCase
      }>(`/api/internal/prospects/${prospectId}/disclosure/preview`, {
        method: "POST",
        body: JSON.stringify(templateId === "" ? {} : { templateId }),
      })
      setDesk(draft.case)
      setPreviewMeta({ recipients: draft.recipients, channel: draft.channel })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not preview the draft.")
    } finally {
      setBusy(null)
    }
  }

  async function acknowledge() {
    setBusy("ack")
    setError(null)
    try {
      const updated = await request<{ case: DisclosureCase; sent: false }>(
        `/api/internal/prospects/${prospectId}/disclosure/acknowledge`,
        { method: "POST", body: JSON.stringify({ note: ackNote }) },
      )
      setDesk(updated.case)
      await onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record acknowledgement.")
    } finally {
      setBusy(null)
    }
  }

  async function assign() {
    setBusy("assign")
    setError(null)
    try {
      const updated = await request<{ case: DisclosureCase }>(
        `/api/internal/prospects/${prospectId}/disclosure/assign`,
        { method: "POST", body: JSON.stringify({ assignee }) },
      )
      setDesk(updated.case)
      await onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign the case.")
    } finally {
      setBusy(null)
    }
  }

  async function review(decision: "approve" | "reject") {
    setBusy("review")
    setError(null)
    try {
      const updated = await request<{ case: DisclosureCase }>(
        `/api/internal/prospects/${prospectId}/disclosure/review`,
        { method: "POST", body: JSON.stringify({ decision, note: reviewNote }) },
      )
      setDesk(updated.case)
      await onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record the review.")
    } finally {
      setBusy(null)
    }
  }

  async function notifyDestination() {
    if (notifyId === "") return
    setBusy("notify")
    setError(null)
    try {
      const result = await request<{ ok: boolean; sent: false; inventedIncident: false; error: string | null }>(
        `/api/internal/prospects/${prospectId}/disclosure/notify`,
        {
          method: "POST",
          body: JSON.stringify({ destinationId: notifyId, confirm: notifyConfirm }),
        },
      )
      if (!result.ok) {
        setError(result.error ?? "Filing the redacted case failed.")
      }
      await onChanged()
      await loadCase()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not file the redacted case.")
    } finally {
      setBusy(null)
    }
  }

  async function addReply() {
    setBusy("reply")
    setError(null)
    try {
      const updated = await request<{ case: DisclosureCase }>(
        `/api/internal/prospects/${prospectId}/disclosure/replies`,
        { method: "POST", body: JSON.stringify({ channel: replyChannel, summary: replySummary }) },
      )
      setDesk(updated.case)
      setReplySummary("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record the vendor reply.")
    } finally {
      setBusy(null)
    }
  }

  async function downloadReport(format: "json" | "html" | "pdf") {
    setBusy("report")
    setError(null)
    try {
      const response = await fetch(
        `/api/internal/prospects/${prospectId}/disclosure/report?format=${format}`,
        {
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      )
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? "Could not build the report.")
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `disclosure-${prospectId}.${format === "html" ? "html" : format}`
      if (format === "html") link.target = "_blank"
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build the report.")
    } finally {
      setBusy(null)
    }
  }

  async function addAttachment() {
    if (!attachmentBytes) {
      setError("Choose a short text, PDF, or image. Archives are not stored.")
      return
    }
    setBusy("attach")
    setError(null)
    try {
      const updated = await request<{ case: DisclosureCase }>(
        `/api/internal/prospects/${prospectId}/disclosure/attachments`,
        {
          method: "POST",
          body: JSON.stringify({
            filename: attachmentName,
            mediaType: attachmentName.endsWith(".pdf")
              ? "application/pdf"
              : attachmentName.endsWith(".png")
                ? "image/png"
                : attachmentName.endsWith(".jpg") || attachmentName.endsWith(".jpeg")
                  ? "image/jpeg"
                  : "text/plain",
            bytes: attachmentBytes,
          }),
        },
      )
      setDesk(updated.case)
      setAttachmentBytes("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not store the attachment.")
    } finally {
      setBusy(null)
    }
  }

  async function rescan() {
    setBusy("rescan")
    setError(null)
    try {
      const updated = await request<{ case: DisclosureCase }>(
        `/api/internal/prospects/${prospectId}/disclosure/rescan`,
        { method: "POST", body: JSON.stringify({ fixVersion }) },
      )
      setDesk(updated.case)
      await onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not queue the rescan.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mt-5 rounded-lg border border-white/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[11px] uppercase tracking-[0.2em] text-dim">Disclosure Desk</p>
          <Badge variant={summary?.state === "verified" ? "clean" : "muted"}>
            {summary?.state ?? "no case"}
          </Badge>
          {summary?.reviewState && summary.reviewState !== "none" ? (
            <Badge variant={summary.reviewState === "approved" ? "clean" : "muted"}>
              {summary.reviewState}
            </Badge>
          ) : null}
          {summary?.deadlineMissed ? <Badge variant="critical">deadline missed</Badge> : null}
          {summary?.findingCategory ? (
            <Badge variant="muted">{summary.findingCategory}</Badge>
          ) : null}
          {summary?.artifactSha256 ? (
            <Badge variant="muted">{summary.artifactSha256.slice(0, 12)}</Badge>
          ) : null}
          {summary?.hasReproducibilitySteps ? <Badge variant="muted">steps</Badge> : null}
          {desk?.duplicateLinks?.length ? <Badge variant="muted">linked</Badge> : null}
          {summary?.conversion && summary.conversion !== "none" ? (
            <Badge variant="muted">{summary.conversion}</Badge>
          ) : null}
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => void toggleOpen()}>
          {open ? "Hide case" : summary ? "Open case" : "Start case"}
        </Button>
      </div>
      {open ? (
        <div className="mt-4 space-y-4">
          <p className="text-xs leading-relaxed text-mute">
            Private verification only. Drafts are never sent. Policy URLs are stored, not fetched.
            Fingerprints are rule|severity|path|title. Finding category is a closed
            label from those rules. A new verified state needs a repeatable artifact
            hash and reproducibility steps. Finding values stay off this desk.
            Do-not-contact always blocks outreach. Missed deadlines stay internal.
            Vendor replies and attachments stay on this desk. Reports include
            reproducibility steps and omit notes and attachment bytes. Outreach still
            requires review approval. Nothing is mailed.
          </p>
          {!desk ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" disabled={Boolean(busy)} onClick={() => void createCase(false)}>
                {busy === "create" ? "Opening…" : "Create private signal"}
              </Button>
              {duplicates?.length ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={Boolean(busy)}
                  onClick={() => void createCase(true)}
                >
                  Confirm duplicate
                </Button>
              ) : null}
              {dnc?.length ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={Boolean(busy)}
                  onClick={() => void createCase(Boolean(duplicates?.length), true)}
                >
                  Research only
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              <ul className="space-y-2">
                {CHECKS.map((item) => (
                  <li key={item.key}>
                    <label className="flex items-center gap-2 text-sm text-snow">
                      <input
                        type="checkbox"
                        checked={desk.checklist[item.key]}
                        disabled={Boolean(busy)}
                        onChange={(event) =>
                          void patch({
                            checklist: { [item.key]: event.target.checked },
                            reproducibilitySteps: reproSteps,
                          })
                        }
                        className="size-3.5 accent-snow"
                      />
                      <span>{item.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <Field>
                <Label className="text-[11px] uppercase tracking-[0.2em] text-dim">
                  Reproducibility steps
                </Label>
                <Textarea
                  value={reproSteps}
                  onChange={(event) => setReproSteps(event.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-md border border-white/15 bg-transparent px-3 py-2 text-sm text-snow outline-none data-focus:border-white/40"
                />
                <p className="mt-1 text-xs text-dim">
                  How you reproduced the public artifact finding. No secret values. Reports
                  include this text.
                </p>
              </Field>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={Boolean(busy)}
                onClick={() => void patch({ reproducibilitySteps: reproSteps })}
              >
                Save steps
              </Button>
              <p className="font-mono text-xs text-dim">
                {desk.artifact.name}
                {desk.artifact.version ? ` · ${desk.artifact.version}` : ""}
                {desk.artifact.sha256 ? ` · ${desk.artifact.sha256}` : " · hash not recorded"}
              </p>
              {desk.organization ? (
                <p className="text-xs text-mute">
                  Organization · {desk.organization.githubOwner}
                  {desk.organization.domains.length
                    ? ` · ${desk.organization.domains.map((row) => row.host).join(", ")}`
                    : " · no vendor domain"}
                </p>
              ) : null}
              {desk.fingerprints.length > 0 ? (
                <ul className="font-mono text-xs text-dim">
                  {desk.fingerprints.map((fp) => (
                    <li key={fp}>{fp}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-dim">No fingerprints yet. Complete a scan first.</p>
              )}
              {desk.duplicateLinks?.length ? (
                <ul className="text-xs text-mute">
                  {desk.duplicateLinks.map((link) => (
                    <li key={link.otherCaseId}>
                      Confirmed duplicate · {link.owner}/{link.repo}
                      {link.packageName ? ` · ${link.packageName}` : ""} · {link.reasons.join(", ")}
                    </li>
                  ))}
                </ul>
              ) : null}
              <Field>
                <Label className="text-[11px] uppercase tracking-[0.2em] text-dim">
                  Finding category
                </Label>
                <select
                  value={findingCategory}
                  onChange={(event) => setFindingCategory(event.target.value as FindingCategory)}
                  className="mt-2 h-10 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none"
                >
                  {FINDING_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={Boolean(busy)}
                onClick={() => void patch({ findingCategory })}
              >
                Save category
              </Button>
              <div className="grid gap-3 md:grid-cols-2">
                <Field>
                  <Label className="text-[11px] uppercase tracking-[0.2em] text-dim">
                    Security contact
                  </Label>
                  <Input
                    value={contact}
                    onChange={(event) => setContact(event.target.value)}
                    className="mt-2 h-10 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none data-focus:border-white/40"
                  />
                </Field>
                <Field>
                  <Label className="text-[11px] uppercase tracking-[0.2em] text-dim">
                    Policy URL
                  </Label>
                  <Input
                    value={policyUrl}
                    onChange={(event) => setPolicyUrl(event.target.value)}
                    placeholder="https://…"
                    className="mt-2 h-10 w-full rounded-md border border-white/15 bg-transparent px-3 font-mono text-xs text-snow outline-none placeholder:text-dim data-focus:border-white/40"
                  />
                </Field>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={Boolean(busy)}
                onClick={() => void patch({ securityContact: contact, policyUrl })}
              >
                Save contact
              </Button>
              <Field>
                <Label className="text-[11px] uppercase tracking-[0.2em] text-dim">
                  Encrypted notes
                </Label>
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-md border border-white/15 bg-transparent px-3 py-2 text-sm text-snow outline-none data-focus:border-white/40"
                />
                {desk.notesExpired ? (
                  <p className="mt-1 text-xs text-dim">Previous notes expired and were not returned.</p>
                ) : null}
              </Field>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={Boolean(busy)}
                onClick={() => void patch({ notes })}
              >
                Save notes
              </Button>
              <div className="grid gap-3 md:grid-cols-2">
                <Field>
                  <Label className="text-[11px] uppercase tracking-[0.2em] text-dim">
                    Vendor channel
                  </Label>
                  <select
                    value={vendorChannel}
                    onChange={(event) => setVendorChannel(event.target.value as VendorChannel | "")}
                    className="mt-2 h-10 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none"
                  >
                    <option value="">unset</option>
                    <option value="security_email">security email</option>
                    <option value="form">form</option>
                    <option value="security_txt">security.txt</option>
                    <option value="platform">platform advisory</option>
                  </select>
                </Field>
                <Field>
                  <Label className="text-[11px] uppercase tracking-[0.2em] text-dim">
                    Draft template
                  </Label>
                  <select
                    value={templateId === "" ? "" : String(templateId)}
                    onChange={(event) =>
                      setTemplateId(event.target.value === "" ? "" : Number(event.target.value))
                    }
                    className="mt-2 h-10 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none"
                  >
                    <option value="">built-in draft</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={Boolean(busy)}
                onClick={() =>
                  void patch({ vendorChannel: vendorChannel === "" ? null : vendorChannel })
                }
              >
                Save channel
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" disabled={Boolean(busy)} onClick={() => void preview()}>
                  {busy === "preview" ? "Previewing…" : "Preview draft"}
                </Button>
                <Badge variant="muted">never sent</Badge>
              </div>
              {desk.draftSubject ? (
                <div className="rounded-md border border-white/10 px-3 py-3">
                  <p className="text-sm text-snow">{desk.draftSubject}</p>
                  {previewMeta?.recipients.length ? (
                    <p className="mt-2 font-mono text-xs text-dim">
                      Recipients · {previewMeta.recipients.join(" · ")}
                      {previewMeta.channel ? ` · ${previewMeta.channel}` : ""}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-dim">No recipient on file. Nothing is mailed.</p>
                  )}
                  <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-mute">
                    {desk.draftBody}
                  </pre>
                </div>
              ) : null}
              <Field>
                <Label className="text-[11px] uppercase tracking-[0.2em] text-dim">
                  Simulated acknowledgement
                </Label>
                <Input
                  value={ackNote}
                  onChange={(event) => setAckNote(event.target.value)}
                  className="mt-2 h-10 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none data-focus:border-white/40"
                />
              </Field>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={Boolean(busy)}
                onClick={() => void acknowledge()}
              >
                Record acknowledgement
              </Button>
              <div className="grid gap-3 md:grid-cols-2">
                <Field>
                  <Label className="text-[11px] uppercase tracking-[0.2em] text-dim">
                    Assignee
                  </Label>
                  <Input
                    value={assignee}
                    onChange={(event) => setAssignee(event.target.value)}
                    placeholder="GitHub login"
                    className="mt-2 h-10 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none data-focus:border-white/40"
                  />
                </Field>
                <Field>
                  <Label className="text-[11px] uppercase tracking-[0.2em] text-dim">
                    Review note
                  </Label>
                  <Input
                    value={reviewNote}
                    onChange={(event) => setReviewNote(event.target.value)}
                    className="mt-2 h-10 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none data-focus:border-white/40"
                  />
                </Field>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => void assign()}>
                  {busy === "assign" ? "Assigning…" : "Assign"}
                </Button>
                <Button type="button" size="sm" disabled={Boolean(busy)} onClick={() => void review("approve")}>
                  Approve review
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={Boolean(busy)}
                  onClick={() => void review("reject")}
                >
                  Reject review
                </Button>
                <p className="text-xs text-dim">
                  {desk.reviewState} {desk.sla.verifiedAt ? `· verified ${desk.sla.verifiedAt.slice(0, 10)}` : ""}
                </p>
              </div>
              {destinations.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <Field>
                    <Label className="text-[11px] uppercase tracking-[0.2em] text-dim">
                      File redacted case
                    </Label>
                    <select
                      value={notifyId}
                      onChange={(event) =>
                        setNotifyId(event.target.value ? Number(event.target.value) : "")
                      }
                      className="mt-2 h-10 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none"
                    >
                      <option value="">Choose destination</option>
                      {destinations.map((destination) => (
                        <option key={destination.id} value={destination.id}>
                          {destination.kind === "jira"
                            ? `jira ${destination.projectKey}`
                            : `webhook ${destination.host}`}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field>
                    <Label className="text-[11px] uppercase tracking-[0.2em] text-dim">
                      Type {owner}/{repo}
                    </Label>
                    <Input
                      value={notifyConfirm}
                      onChange={(event) => setNotifyConfirm(event.target.value)}
                      className="mt-2 h-10 w-full rounded-md border border-white/15 bg-transparent px-3 font-mono text-xs text-snow outline-none data-focus:border-white/40"
                    />
                  </Field>
                  <div className="md:col-span-2 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={
                        Boolean(busy) ||
                        notifyId === "" ||
                        desk.state !== "verified" ||
                        notifyConfirm.trim() !== `${owner}/${repo}`
                      }
                      onClick={() => void notifyDestination()}
                    >
                      {busy === "notify" ? "Filing…" : "File redacted case"}
                    </Button>
                    <p className="text-xs text-dim">Verified cases only. Nothing is mailed.</p>
                  </div>
                </div>
              ) : null}
              <div className="grid gap-3 md:grid-cols-2">
                <Field>
                  <Label className="text-[11px] uppercase tracking-[0.2em] text-dim">
                    Vendor reply channel
                  </Label>
                  <select
                    value={replyChannel}
                    onChange={(event) => setReplyChannel(event.target.value as VendorReplyChannel)}
                    className="mt-2 h-10 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none"
                  >
                    <option value="security_email">security email</option>
                    <option value="form">form</option>
                    <option value="security_txt">security.txt</option>
                    <option value="platform">platform</option>
                    <option value="other">other</option>
                  </select>
                </Field>
                <Field>
                  <Label className="text-[11px] uppercase tracking-[0.2em] text-dim">
                    Vendor reply
                  </Label>
                  <Input
                    value={replySummary}
                    onChange={(event) => setReplySummary(event.target.value)}
                    placeholder="Vendor acknowledged by email"
                    className="mt-2 h-10 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none data-focus:border-white/40"
                  />
                </Field>
              </div>
              <Button type="button" size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => void addReply()}>
                {busy === "reply" ? "Saving…" : "Record vendor reply"}
              </Button>
              {desk.replies.length > 0 ? (
                <ul className="font-mono text-xs text-dim">
                  {desk.replies.map((row) => (
                    <li key={row.id}>
                      {row.channel} · {row.summary}
                    </li>
                  ))}
                </ul>
              ) : null}
              <Field>
                <Label className="text-[11px] uppercase tracking-[0.2em] text-dim">
                  Encrypted attachment
                </Label>
                <Input
                  value={attachmentName}
                  onChange={(event) => setAttachmentName(event.target.value)}
                  className="mt-2 h-10 w-full rounded-md border border-white/15 bg-transparent px-3 font-mono text-xs text-snow outline-none data-focus:border-white/40"
                />
                <input
                  type="file"
                  accept=".txt,.md,.pdf,.png,.jpg,.jpeg,text/plain,text/markdown,application/pdf,image/png,image/jpeg"
                  className="mt-2 block text-xs text-dim"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (!file) {
                      setAttachmentBytes("")
                      return
                    }
                    setAttachmentName(file.name)
                    const reader = new FileReader()
                    reader.onload = () => {
                      const result = typeof reader.result === "string" ? reader.result : ""
                      const comma = result.indexOf(",")
                      setAttachmentBytes(comma >= 0 ? result.slice(comma + 1) : result)
                    }
                    reader.readAsDataURL(file)
                  }}
                />
              </Field>
              <Button type="button" size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => void addAttachment()}>
                {busy === "attach" ? "Storing…" : "Store attachment"}
              </Button>
              {desk.attachments.length > 0 ? (
                <ul className="font-mono text-xs text-dim">
                  {desk.attachments.map((row) => (
                    <li key={row.id}>
                      {row.filename} · {row.byteLength} bytes{row.expired ? " · expired" : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="ghost" disabled={Boolean(busy)} onClick={() => void downloadReport("json")}>
                  JSON report
                </Button>
                <Button type="button" size="sm" variant="ghost" disabled={Boolean(busy)} onClick={() => void downloadReport("html")}>
                  HTML report
                </Button>
                <Button type="button" size="sm" variant="ghost" disabled={Boolean(busy)} onClick={() => void downloadReport("pdf")}>
                  PDF report
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Field>
                  <Label className="text-[11px] uppercase tracking-[0.2em] text-dim">
                    Internal deadline
                  </Label>
                  <Input
                    type="datetime-local"
                    value={deadline}
                    onChange={(event) => setDeadline(event.target.value)}
                    className="mt-2 h-10 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none data-focus:border-white/40"
                  />
                </Field>
                <Field>
                  <Label className="text-[11px] uppercase tracking-[0.2em] text-dim">
                    Conversion
                  </Label>
                  <select
                    value={conversion}
                    onChange={(event) => setConversion(event.target.value as DisclosureConversion)}
                    className="mt-2 h-10 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none"
                  >
                    <option value="none">none</option>
                    <option value="trial">trial</option>
                    <option value="paid">paid</option>
                    <option value="declined">declined</option>
                  </select>
                </Field>
                <Field>
                  <Label className="text-[11px] uppercase tracking-[0.2em] text-dim">
                    Fix version
                  </Label>
                  <Input
                    value={fixVersion}
                    onChange={(event) => setFixVersion(event.target.value)}
                    className="mt-2 h-10 w-full rounded-md border border-white/15 bg-transparent px-3 font-mono text-sm text-snow outline-none data-focus:border-white/40"
                  />
                </Field>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Field>
                  <Label className="text-[11px] uppercase tracking-[0.2em] text-dim">
                    Credit
                  </Label>
                  <Input
                    value={outcomeCredit}
                    onChange={(event) => setOutcomeCredit(event.target.value)}
                    className="mt-2 h-10 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none data-focus:border-white/40"
                  />
                </Field>
                <Field>
                  <Label className="text-[11px] uppercase tracking-[0.2em] text-dim">CVE</Label>
                  <Input
                    value={outcomeCve}
                    onChange={(event) => setOutcomeCve(event.target.value)}
                    className="mt-2 h-10 w-full rounded-md border border-white/15 bg-transparent px-3 font-mono text-sm text-snow outline-none data-focus:border-white/40"
                  />
                </Field>
                <Field>
                  <Label className="text-[11px] uppercase tracking-[0.2em] text-dim">
                    Outcome notes
                  </Label>
                  <Input
                    value={outcomeNotes}
                    onChange={(event) => setOutcomeNotes(event.target.value)}
                    className="mt-2 h-10 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none data-focus:border-white/40"
                  />
                </Field>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={Boolean(busy)}
                  onClick={() =>
                    void patch({
                      deadlineAt: deadline ? new Date(deadline).toISOString() : null,
                      conversion,
                      vendorChannel: vendorChannel === "" ? null : vendorChannel,
                      outcomeCredit,
                      outcomeCve,
                      outcomeNotes,
                    })
                  }
                >
                  Save deadline / conversion
                </Button>
                <Button type="button" size="sm" disabled={Boolean(busy)} onClick={() => void rescan()}>
                  {busy === "rescan" ? "Queueing…" : "Rescan fix version"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={Boolean(busy)}
                  onClick={() => void patch({ state: "false_positive" })}
                >
                  False positive
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={Boolean(busy)}
                  onClick={() => void patch({ state: "duplicate" })}
                >
                  Mark duplicate
                </Button>
              </div>
              {desk.events.length > 0 ? (
                <ol className="space-y-1 font-mono text-xs text-dim">
                  {desk.events.map((event) => (
                    <li key={event.id}>
                      {event.summary} · {event.actor}
                    </li>
                  ))}
                </ol>
              ) : null}
            </>
          )}
          {duplicates?.length ? (
            <ul className="text-xs text-mute">
              {duplicates.map((row) => (
                <li key={row.caseId}>
                  {row.owner}/{row.repo}
                  {row.packageName ? ` · ${row.packageName}` : ""} · {row.reasons.join(", ")}
                </li>
              ))}
            </ul>
          ) : null}
          {dnc?.length ? (
            <ul className="text-xs text-mute">
              {dnc.map((row) => (
                <li key={row.id}>
                  Do not contact · {row.reason} · {row.reasons.join(", ")}
                </li>
              ))}
            </ul>
          ) : null}
          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
