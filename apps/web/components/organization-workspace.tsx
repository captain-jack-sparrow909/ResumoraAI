"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Building2,
  Check,
  ChevronRight,
  CircleAlert,
  Globe2,
  GraduationCap,
  LayoutDashboard,
  LockKeyhole,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";
import {
  applicationSchema,
  buildCareerIntelligence,
  careerEvidenceSchema,
  careerGoalSchema,
  careerLearningPlanSchema,
  careerOutcomeSchema,
  demoApplications,
  demoCareerEvidence,
  demoResume,
  resumeSchema,
  type CareerLearningPlan,
  OrganizationDataGrant,
  OrganizationParticipantProfile,
} from "@resumora/domain";
import { Logo } from "@/components/logo";
import {
  acceptOrganizationInvite,
  createOrganization,
  createOrganizationCohort,
  createOrganizationInvite,
  loadOrganizations,
  loadOrganizationWorkspace,
  saveOrganizationProfile,
  updateOrganizationGrant,
  type OrganizationSummary,
  type OrganizationWorkspacePayload,
} from "@/lib/api";
import { getSupabaseBrowserClient } from "@/lib/supabase";

const demoOrganization: OrganizationSummary = {
  id: "demo-career-lab",
  name: "Northstar Career Lab",
  slug: "northstar-career-lab",
  type: "coaching",
  role: "owner",
  createdAt: "2026-07-01T09:00:00.000Z",
};
const demoProfiles: OrganizationParticipantProfile[] = [
  {
    organizationId: demoOrganization.id,
    participantUserId: "maya",
    displayName: "Maya Chen",
    targetTitle: "Lead Product Designer",
    readiness: 72,
    evidenceCount: 11,
    applicationsActive: 4,
    learningCompleted: 3,
    learningTotal: 5,
    updatedAt: "2026-08-01T08:00:00.000Z",
  },
  {
    organizationId: demoOrganization.id,
    participantUserId: "omar",
    displayName: "Omar Haddad",
    targetTitle: "Platform Engineer",
    readiness: 61,
    evidenceCount: 8,
    applicationsActive: 3,
    learningCompleted: 2,
    learningTotal: 6,
    updatedAt: "2026-07-31T11:00:00.000Z",
  },
  {
    organizationId: demoOrganization.id,
    participantUserId: "ana",
    displayName: "Ana Costa",
    targetTitle: "Data Scientist",
    readiness: 78,
    evidenceCount: 14,
    applicationsActive: 5,
    learningCompleted: 4,
    learningTotal: 5,
    updatedAt: "2026-07-30T15:00:00.000Z",
  },
];
const demoWorkspace: OrganizationWorkspacePayload = {
  organization: demoOrganization,
  members: [
    {
      organization_id: demoOrganization.id,
      user_id: "owner",
      display_name: "Avery Morgan",
      email: "avery@example.com",
      role: "owner",
      joined_at: "2026-07-01T09:00:00.000Z",
    },
    ...demoProfiles.map((profile) => ({
      organization_id: demoOrganization.id,
      user_id: profile.participantUserId,
      display_name: profile.displayName,
      email: "Shared by participant",
      role: "participant",
      joined_at: profile.updatedAt,
    })),
  ],
  grants: demoProfiles.map((profile) => ({
    organizationId: demoOrganization.id,
    participantUserId: profile.participantUserId,
    scopes: ["resume_summary", "learning_plan"],
    consentedAt: profile.updatedAt,
  })),
  profiles: demoProfiles,
  cohorts: [
    {
      id: "cohort-demo",
      organization_id: demoOrganization.id,
      name: "August leadership cohort",
      created_at: "2026-08-01T08:00:00.000Z",
    },
  ],
};

const scopeLabels: Record<OrganizationDataGrant["scopes"][number], string> = {
  resume_summary: "Career summary",
  career_evidence: "Selected evidence",
  application_progress: "Application progress",
  learning_plan: "Learning plan",
};

export function OrganizationWorkspace() {
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([
    demoOrganization,
  ]);
  const [active, setActive] =
    useState<OrganizationWorkspacePayload>(demoWorkspace);
  const [notice, setNotice] = useState(
    "Demo workspace · sign in to create a private organization.",
  );
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<
    "participant" | "coach" | "admin"
  >("participant");
  const [newOrgOpen, setNewOrgOpen] = useState(false);
  const [newOrg, setNewOrg] = useState({
    name: "",
    slug: "",
    type: "coaching" as OrganizationSummary["type"],
  });
  const [cohortName, setCohortName] = useState("");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    void supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      if (!session) return;
      const accessToken = session.access_token;
      setToken(accessToken);
      setUserId(session.user.id);
      setUserName(
        session.user.user_metadata?.full_name ??
          session.user.email ??
          "Participant",
      );
      try {
        const inviteToken = new URLSearchParams(location.hash.slice(1)).get(
          "invite",
        );
        if (inviteToken) {
          await acceptOrganizationInvite(
            inviteToken,
            data.session?.user.user_metadata?.full_name ?? "",
            accessToken,
          );
          history.replaceState(null, "", location.pathname + location.search);
        }
        const result = await loadOrganizations(accessToken);
        if (!result.organizations.length) {
          setOrganizations([]);
          setNotice("No organization yet. Create one when you are ready.");
          return;
        }
        setOrganizations(result.organizations);
        const workspace = await loadOrganizationWorkspace(
          result.organizations[0].id,
          accessToken,
        );
        setActive(workspace);
        setNotice("Private organization data loaded.");
      } catch {
        setNotice(
          "Organization sync is unavailable; the demo remains visible.",
        );
      }
    });
  }, []);

  const staff = ["owner", "admin", "coach"].includes(active.organization.role);
  const activeGrants = useMemo(
    () => active.grants.filter((grant) => !grant.revokedAt),
    [active.grants],
  );
  const averageReadiness = active.profiles.length
    ? Math.round(
        active.profiles.reduce((sum, profile) => sum + profile.readiness, 0) /
          active.profiles.length,
      )
    : 0;
  const switchOrganization = async (organization: OrganizationSummary) => {
    if (!token || organization.id === demoOrganization.id) {
      setActive(demoWorkspace);
      return;
    }
    try {
      setActive(await loadOrganizationWorkspace(organization.id, token));
    } catch {
      setNotice("Could not open that organization.");
    }
  };
  const createOrg = async () => {
    if (!token) {
      setNotice("Sign in before creating a private organization.");
      return;
    }
    try {
      const result = await createOrganization(newOrg, token);
      const workspace = await loadOrganizationWorkspace(
        result.organization.id,
        token,
      );
      setOrganizations((items) => [result.organization, ...items]);
      setActive(workspace);
      setNewOrgOpen(false);
      setNotice("Organization created with you as owner.");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Could not create organization.",
      );
    }
  };
  const invite = async () => {
    if (!token || active.organization.id === demoOrganization.id) {
      setNotice(
        "Sign in and open a private organization before inviting members.",
      );
      return;
    }
    try {
      const result = await createOrganizationInvite(
        active.organization.id,
        { email: inviteEmail, role: inviteRole, expiresInDays: 7 },
        token,
      );
      await navigator.clipboard?.writeText(
        `${location.origin}/organizations#invite=${result.token}`,
      );
      setInviteEmail("");
      setNotice(
        "Secure invitation copied. It expires in seven days and only the invited email can accept it.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not create invitation.",
      );
    }
  };
  const createCohort = async () => {
    if (!token || active.organization.id === demoOrganization.id) {
      setNotice(
        "Sign in and open a private organization before creating cohorts.",
      );
      return;
    }
    try {
      const result = await createOrganizationCohort(
        active.organization.id,
        cohortName,
        token,
      );
      setActive((current) => ({
        ...current,
        cohorts: [...current.cohorts, result.cohort],
      }));
      setCohortName("");
      setNotice("Cohort created.");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not create cohort.",
      );
    }
  };
  const updateScope = async (
    scope: OrganizationDataGrant["scopes"][number],
    enabled: boolean,
  ) => {
    const own = active.grants[0];
    const scopes = enabled
      ? Array.from(new Set([...(own?.scopes ?? []), scope]))
      : (own?.scopes ?? []).filter((item) => item !== scope);
    if (!token || active.organization.role !== "participant") {
      setNotice("Only the participant can change these sharing controls.");
      return;
    }
    try {
      const result = await updateOrganizationGrant(
        active.organization.id,
        scopes,
        token,
      );
      let sharedProfile: OrganizationParticipantProfile | null = null;
      if (enabled && scope === "resume_summary" && userId) {
        const read = (key: string): unknown => {
          try {
            return JSON.parse(localStorage.getItem(key) ?? "null") as unknown;
          } catch {
            return null;
          }
        };
        const savedResume = resumeSchema.safeParse(read("resumora:resume"));
        const savedEvidence = Array.isArray(read("resumora:career-vault"))
          ? (read("resumora:career-vault") as unknown[]).flatMap((item) => {
              const parsed = careerEvidenceSchema.safeParse(item);
              return parsed.success ? [parsed.data] : [];
            })
          : demoCareerEvidence;
        const savedApplications = Array.isArray(read("resumora:applications"))
          ? (read("resumora:applications") as unknown[]).flatMap((item) => {
              const parsed = applicationSchema.safeParse(item);
              return parsed.success ? [parsed.data] : [];
            })
          : demoApplications;
        const savedOutcomes = Array.isArray(read("resumora:career-outcomes"))
          ? (read("resumora:career-outcomes") as unknown[]).flatMap((item) => {
              const parsed = careerOutcomeSchema.safeParse(item);
              return parsed.success ? [parsed.data] : [];
            })
          : [];
        const savedGoal = careerGoalSchema.safeParse(
          read("resumora:career-goal"),
        );
        const targetRoleId = savedGoal.success
          ? savedGoal.data.targetRoleId
          : "lead-product-designer";
        const report = buildCareerIntelligence(
          savedResume.success ? savedResume.data : demoResume,
          savedEvidence,
          savedApplications,
          savedOutcomes,
          targetRoleId,
        );
        const rawPlans = read("resumora:career-plans");
        const candidatePlan =
          rawPlans && typeof rawPlans === "object"
            ? (rawPlans as Record<string, unknown>)[targetRoleId]
            : null;
        const parsedPlan = careerLearningPlanSchema.safeParse(candidatePlan);
        const plan: CareerLearningPlan = parsedPlan.success
          ? parsedPlan.data
          : report.learningPlan;
        sharedProfile = {
          organizationId: active.organization.id,
          participantUserId: userId,
          displayName: userName,
          targetTitle: report.targetRole.title,
          readiness: report.readiness,
          evidenceCount: savedEvidence.filter((item) => item.verified).length,
          applicationsActive: savedApplications.filter(
            (item) =>
              !["rejected", "withdrawn", "accepted"].includes(item.status),
          ).length,
          learningCompleted: plan.actions.filter(
            (action) => action.status === "completed",
          ).length,
          learningTotal: plan.actions.length,
          updatedAt: new Date().toISOString(),
        };
        await saveOrganizationProfile(
          active.organization.id,
          sharedProfile,
          token,
        );
      }
      setActive((current) => ({
        ...current,
        grants: [
          ...current.grants.filter(
            (grant) =>
              grant.participantUserId !== result.grant.participantUserId,
          ),
          result.grant,
        ],
        profiles: sharedProfile
          ? [
              ...current.profiles.filter(
                (profile) =>
                  profile.participantUserId !==
                  sharedProfile?.participantUserId,
              ),
              sharedProfile,
            ]
          : current.profiles,
      }));
      setNotice("Sharing consent updated.");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not update consent.",
      );
    }
  };

  return (
    <main className="organization-shell">
      <header className="organization-topbar">
        <Logo />
        <nav>
          <Link href="/intelligence">
            <Sparkles size={14} /> Intelligence
          </Link>
          <Link href="/portfolio">
            <Globe2 size={14} /> Portfolio
          </Link>
          <Link href="/applications">
            <LayoutDashboard size={14} /> Applications
          </Link>
        </nav>
        <span>
          <LockKeyhole size={12} /> {token ? "Member session" : "Demo · local"}
        </span>
      </header>
      <div className="organization-layout">
        <aside className="organization-sidebar">
          <header>
            <span>Organizations</span>
            <button
              aria-label="Create organization"
              onClick={() => setNewOrgOpen((value) => !value)}
            >
              <Plus size={14} />
            </button>
          </header>
          {organizations.map((organization) => (
            <button
              aria-label={organization.name}
              aria-current={
                active.organization.id === organization.id ? "page" : undefined
              }
              className={
                active.organization.id === organization.id ? "active" : ""
              }
              key={organization.id}
              onClick={() => void switchOrganization(organization)}
            >
              <i>
                <Building2 size={15} />
              </i>
              <span>
                <strong>{organization.name}</strong>
                <small>
                  {organization.type} · {organization.role}
                </small>
              </span>
              <ChevronRight size={13} />
            </button>
          ))}
          {newOrgOpen && (
            <div className="new-organization-form">
              <input
                aria-label="Organization name"
                placeholder="Organization name"
                value={newOrg.name}
                onChange={(event) =>
                  setNewOrg({
                    ...newOrg,
                    name: event.target.value,
                    slug: event.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-|-$/g, ""),
                  })
                }
              />
              <input
                aria-label="Organization address"
                placeholder="workspace-address"
                value={newOrg.slug}
                onChange={(event) =>
                  setNewOrg({ ...newOrg, slug: event.target.value })
                }
              />
              <select
                aria-label="Organization type"
                value={newOrg.type}
                onChange={(event) =>
                  setNewOrg({
                    ...newOrg,
                    type: event.target.value as OrganizationSummary["type"],
                  })
                }
              >
                <option value="coaching">Coaching</option>
                <option value="university">University</option>
                <option value="outplacement">Outplacement</option>
                <option value="employer">Employer</option>
              </select>
              <button onClick={() => void createOrg()}>Create workspace</button>
            </div>
          )}
          <div className="organization-safety">
            <ShieldCheck size={15} />
            <p>
              <strong>Consent before visibility</strong>Membership never grants
              automatic access to a participant&apos;s career data.
            </p>
          </div>
        </aside>
        <section className="organization-main">
          <div className="organization-heading">
            <div>
              <span>{active.organization.type} workspace</span>
              <h1>{active.organization.name}</h1>
              <p>
                Cohort-level signals from participant-approved summaries.
                Private notes, outcomes, and complete resumes stay outside this
                workspace.
              </p>
            </div>
            <button
              onClick={() =>
                document.getElementById("org-invite-email")?.focus()
              }
            >
              <UserRoundPlus size={14} /> Add members
            </button>
          </div>
          <div className="organization-metrics">
            <Metric
              icon={UsersRound}
              value={active.profiles.length}
              label="Sharing participants"
            />
            <Metric
              icon={BarChart3}
              value={`${averageReadiness}%`}
              label="Average readiness"
            />
            <Metric
              icon={GraduationCap}
              value={active.cohorts.length}
              label="Active cohorts"
            />
            <Metric
              icon={ShieldCheck}
              value={activeGrants.length}
              label="Active grants"
            />
          </div>
          {staff ? (
            <>
              <section className="org-panel roster-panel">
                <header>
                  <div>
                    <span>Participant overview</span>
                    <h2>Progress without surveillance.</h2>
                  </div>
                  <small>
                    <LockKeyhole size={11} /> Consent-filtered
                  </small>
                </header>
                <div className="org-roster">
                  {active.profiles.map((profile) => (
                    <article key={profile.participantUserId}>
                      <div className="member-avatar">
                        {profile.displayName
                          .split(" ")
                          .map((part) => part[0])
                          .slice(0, 2)
                          .join("")}
                      </div>
                      <div>
                        <strong>{profile.displayName}</strong>
                        <span>{profile.targetTitle}</span>
                      </div>
                      <b>
                        {profile.readiness}%<small>readiness</small>
                      </b>
                      <p>
                        {profile.evidenceCount}
                        <small>proof records</small>
                      </p>
                      <p>
                        {profile.learningCompleted}/{profile.learningTotal}
                        <small>plan complete</small>
                      </p>
                      <i>
                        <Check size={12} /> shared
                      </i>
                    </article>
                  ))}
                  {!active.profiles.length && (
                    <div className="org-empty">
                      <UsersRound size={24} />
                      <strong>No shared participant summaries yet.</strong>
                      <p>
                        Invite participants, then let each person choose what
                        the organization can see.
                      </p>
                    </div>
                  )}
                </div>
              </section>
              <div className="organization-two-column">
                <section className="org-panel">
                  <header>
                    <div>
                      <span>Member invitation</span>
                      <h2>Invite with a bounded role.</h2>
                    </div>
                  </header>
                  <label>
                    <span>Email</span>
                    <input
                      id="org-invite-email"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                      placeholder="participant@example.com"
                    />
                  </label>
                  <label>
                    <span>Role</span>
                    <select
                      value={inviteRole}
                      onChange={(event) =>
                        setInviteRole(event.target.value as typeof inviteRole)
                      }
                    >
                      <option value="participant">Participant</option>
                      <option value="coach">Coach</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </label>
                  <button
                    className="org-primary"
                    onClick={() => void invite()}
                    disabled={!inviteEmail}
                  >
                    <Send size={13} /> Create secure invite
                  </button>
                  <p className="bounded-note">
                    <LockKeyhole size={12} /> Seven-day, single-email
                    invitation. No career data is shared on acceptance.
                  </p>
                </section>
                <section className="org-panel">
                  <header>
                    <div>
                      <span>Cohorts</span>
                      <h2>Group support programs.</h2>
                    </div>
                  </header>
                  <div className="cohort-list">
                    {active.cohorts.map((cohort) => (
                      <div key={cohort.id}>
                        <i>
                          <UsersRound size={14} />
                        </i>
                        <span>
                          <strong>{cohort.name}</strong>
                          <small>Organization cohort</small>
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="cohort-create">
                    <input
                      aria-label="Cohort name"
                      value={cohortName}
                      onChange={(event) => setCohortName(event.target.value)}
                      placeholder="September job-search cohort"
                    />
                    <button
                      aria-label="Create cohort"
                      onClick={() => void createCohort()}
                      disabled={!cohortName}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </section>
              </div>
            </>
          ) : (
            <ParticipantConsent active={active} onScope={updateScope} />
          )}
          <p className="organization-notice">
            <CircleAlert size={13} />
            {notice}
          </p>
        </section>
      </div>
    </main>
  );
}

function ParticipantConsent({
  active,
  onScope,
}: {
  active: OrganizationWorkspacePayload;
  onScope: (
    scope: OrganizationDataGrant["scopes"][number],
    enabled: boolean,
  ) => void;
}) {
  const own = active.grants[0];
  return (
    <section className="org-panel participant-consent">
      <header>
        <div>
          <span>Your sharing consent</span>
          <h2>You control every scope.</h2>
          <p>
            Turning a scope off revokes organization access. It does not delete
            your private Resumora data.
          </p>
        </div>
      </header>
      {Object.entries(scopeLabels).map(([scope, label]) => (
        <label key={scope}>
          <input
            type="checkbox"
            checked={Boolean(
              own &&
              !own.revokedAt &&
              own.scopes.includes(
                scope as OrganizationDataGrant["scopes"][number],
              ),
            )}
            onChange={(event) =>
              void onScope(
                scope as OrganizationDataGrant["scopes"][number],
                event.target.checked,
              )
            }
          />
          <span>
            <strong>{label}</strong>
            <small>
              {scope === "resume_summary"
                ? "Target role, readiness, and proof counts"
                : scope === "career_evidence"
                  ? "Only records you separately approve"
                  : scope === "application_progress"
                    ? "Stage counts without employer notes"
                    : "Plan progress without coaching answers"}
            </small>
          </span>
        </label>
      ))}
    </section>
  );
}

function Metric({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof UsersRound;
  value: string | number;
  label: string;
}) {
  return (
    <div>
      <Icon size={16} />
      <span>
        <strong>{value}</strong>
        <small>{label}</small>
      </span>
    </div>
  );
}
