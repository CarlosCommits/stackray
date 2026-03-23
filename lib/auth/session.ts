export type SessionActorSource = "ui" | "cli" | "api" | "system";

export type AppSession = {
  user: {
    id: string;
    email: string;
    displayName: string;
  };
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
  source: SessionActorSource;
};

const defaultSession: AppSession = {
  user: {
    id: "usr_demo_01",
    email: "operator@stackray.local",
    displayName: "Stackray Operator",
  },
  workspace: {
    id: "ws_demo_01",
    name: "Workspace Alpha",
    slug: "workspace-alpha",
  },
  source: "ui",
};

export async function getAppSession(): Promise<AppSession | null> {
  return defaultSession;
}

export async function requireAppSession(): Promise<AppSession> {
  const session = await getAppSession();

  if (!session) {
    throw new Error("Authentication is not configured yet.");
  }

  return session;
}
