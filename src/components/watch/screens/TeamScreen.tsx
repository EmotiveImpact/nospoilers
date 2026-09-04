import { WatchPageHeader } from "@/components/watch/WatchPageHeader";
import { useWatchScreenContext } from "@/components/watch/useWatchScreenContext";
import { useRef } from "react";

export function TeamScreen() {
  const inviteLoginRef = useRef<HTMLInputElement>(null);
  const { Avatar, AvatarFallback, AvatarImage, Button, adminCount, beginConfirm, canManageRoles, confirmBusy, confirmForm, confirming, deskCoverage, ended, inviteLogin, inviteRole, invites, members, membersError, previewing, route, setInviteLogin, setInviteRole } = useWatchScreenContext();
  return (
    <>
      {route.view === "team" && (
              <section className="mt-4">
                <WatchPageHeader
                  title="Team & roles"
                  lede="People who can view or administer this install."
                  action={
                    canManageRoles ? (
                      <Button type="button" size="sm" onClick={() => inviteLoginRef.current?.focus()}>
                        Invite
                      </Button>
                    ) : undefined
                  }
                />
                <p className="watch-guidance mt-3 max-w-xl text-[13px] leading-relaxed text-mute">
                  The first GitHub user to connect this install is admin. Later users become members.
                  Admins change roles, remove people, and invite by GitHub login. Invites do not send
                  email and do not grant GitHub Administration. The last admin stays.
                </p>
                {previewing ? (
                  <>
                    <p className="mt-6 text-sm leading-relaxed text-mute">
                      Preview cannot manage Team roles. No invented incident.
                    </p>
                    <div className="watch-empty">Nobody linked on this install yet.</div>
                  </>
                ) : deskCoverage?.plan === "solo" ? (
                  <p className="mt-6 text-sm leading-relaxed text-mute">
                    Team roles are on trial and Team.
                  </p>
                ) : ended ? (
                  <p className="mt-6 text-sm leading-relaxed text-mute">
                    Subscribe to Team to keep managing roles.
                  </p>
                ) : null}
                {previewing ? null : membersError ? (
                  <p className="mt-6 text-sm text-danger">{membersError}</p>
                ) : (
                  <>
                    {canManageRoles ? (
                      <form
                        className="mt-6 flex max-w-xl flex-col gap-3 rounded-lg border border-white/8 bg-panel p-5 sm:flex-row sm:items-end"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const login = inviteLogin.trim();
                          if (!login || confirmBusy) return;
                          beginConfirm({
                            kind: "invite",
                            login,
                            role: inviteRole,
                            expected: login,
                          });
                        }}
                      >
                        <label className="min-w-0 flex-1">
                          <span className="text-xs uppercase tracking-[0.16em] text-dim">
                            GitHub login
                          </span>
                          <input
                            ref={inviteLoginRef}
                            id="team-invite-login"
                            value={inviteLogin}
                            onChange={(event) => setInviteLogin(event.target.value)}
                            placeholder="octocat"
                            autoComplete="off"
                            spellCheck={false}
                            className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
                          />
                        </label>
                        <label>
                          <span className="text-xs uppercase tracking-[0.16em] text-dim">Role</span>
                          <select
                            value={inviteRole}
                            onChange={(event) =>
                              setInviteRole(event.target.value === "admin" ? "admin" : "member")
                            }
                            className="mt-2 h-11 w-full rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40"
                          >
                            <option value="member">member</option>
                            <option value="admin">admin</option>
                          </select>
                        </label>
                        <Button type="submit" size="sm" disabled={confirmBusy || !inviteLogin.trim()}>
                          Invite
                        </Button>
                      </form>
                    ) : null}
                    {confirmForm(confirming?.kind === "invite")}
                    {invites.length > 0 ? (
                      <ul className="mt-6 max-w-xl divide-y divide-white/5 rounded-lg border border-white/8 bg-panel px-4">
                        {invites.map((invite) => (
                          <li key={invite.id} className="py-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="text-sm text-snow">{invite.githubLogin}</p>
                                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-dim">
                                  pending {invite.role}
                                </p>
                              </div>
                              {canManageRoles ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  disabled={confirmBusy}
                                  onClick={() =>
                                    beginConfirm({
                                      kind: "invite-revoke",
                                      id: invite.id,
                                      expected: invite.githubLogin,
                                    })
                                  }
                                >
                                  Revoke
                                </Button>
                              ) : null}
                            </div>
                            {confirmForm(confirming?.kind === "invite-revoke" && confirming.id === invite.id)}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {members.length === 0 && invites.length === 0 ? (
                      <div className="watch-empty">Nobody linked on this install yet.</div>
                    ) : (
                      <div className="mt-5 flex flex-wrap gap-2">
                        {members.map((member) => (
                          <span key={`pill-${member.userId}`} className="watch-chip">
                            @{member.login}
                            <span className="text-dim">{member.role}</span>
                          </span>
                        ))}
                        {invites.map((invite) => (
                          <span key={`pill-${invite.id}`} className="watch-chip">
                            @{invite.githubLogin}
                            <span className="text-dim">pending {invite.role}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    {members.length === 0 ? null : (
                      <ul className="mt-6 max-w-xl divide-y divide-white/5 rounded-lg border border-white/8 bg-panel px-4">
                        {members.map((member) => (
                          <li key={member.userId} className="py-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="border border-white/10">
                                <AvatarFallback>{member.login.slice(0, 2).toUpperCase()}</AvatarFallback>
                                {member.avatarUrl ? <AvatarImage src={member.avatarUrl} /> : null}
                              </Avatar>
                              <div>
                                <p className="text-sm text-snow">@{member.login}</p>
                                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-dim">{member.role}</p>
                              </div>
                            </div>
                            {canManageRoles ? (
                              <div className="flex flex-wrap gap-2">
                                {member.role === "member" ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={confirmBusy}
                                    onClick={() =>
                                      beginConfirm({
                                        kind: "role",
                                        userId: member.userId,
                                        expected: member.login,
                                        role: "admin",
                                      })
                                    }
                                  >
                                    Make admin
                                  </Button>
                                ) : (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={confirmBusy || adminCount <= 1}
                                    onClick={() =>
                                      beginConfirm({
                                        kind: "role",
                                        userId: member.userId,
                                        expected: member.login,
                                        role: "member",
                                      })
                                    }
                                  >
                                    Make member
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  disabled={confirmBusy || (member.role === "admin" && adminCount <= 1)}
                                  onClick={() =>
                                    beginConfirm({
                                      kind: "member",
                                      userId: member.userId,
                                      expected: member.login,
                                    })
                                  }
                                >
                                  Remove
                                </Button>
                              </div>
                            ) : null}
                            </div>
                            {confirmForm(
                              (confirming?.kind === "member" && confirming.userId === member.userId) ||
                                (confirming?.kind === "role" && confirming.userId === member.userId),
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </section>
              )}
    </>
  );
}
