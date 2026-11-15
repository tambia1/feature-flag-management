import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";

const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    tracesSampleRate: 0.1,
    // Privacy: no user details, cookies, headers or request bodies.
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [] },
    // Mask user details (privacy).
    beforeSend(event) {
      delete event.user;
      return event;
    },
  });
}

if (posthogKey) {
  posthog.init(posthogKey, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    // Key events only, no personal data.
    autocapture: false,
    capture_pageview: true,
    person_profiles: "never",
    disable_session_recording: true,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
