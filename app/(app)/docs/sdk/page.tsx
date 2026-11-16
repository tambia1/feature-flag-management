import type { Metadata } from "next";
import { headers } from "next/headers";
import { Table } from "@/app/_components/Table";
import { Card } from "../../_components/Card";
import { Page } from "../../_components/Page";
import { CodeBlock } from "./CodeBlock";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "SDK docs" };

const sdkPackage = { name: "@feature-flags/sdk", version: "0.1.0" };

export default async function SdkDocsPage() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = `${protocol}://${host}`;
  const tarball = `feature-flags-sdk-${sdkPackage.version}.tgz`;

  return (
    <Page title="SDK" subtitle="Read your feature flags from any JavaScript or TypeScript app.">
      <div className={styles.docs}>
        <Card title="1. Install the package">
          <p>
            The SDK is in the <code>sdk/</code> folder of this repository. Until it is published to a registry, build it into a package file
            and install that file in your app.
          </p>
          <CodeBlock label="In this repository" code={`cd sdk\nnpm pack`} />
          <p>
            <code>npm pack</code> builds the SDK and writes <code>{tarball}</code> in the <code>sdk/</code> folder. Copy it into your app,
            then install it:
          </p>
          <CodeBlock label="In your app" code={`npm install ./${tarball}`} />
          <p>
            Your <code>package.json</code> then lists <code>&quot;{sdkPackage.name}&quot;</code>, and you import it like any other package.
            Once the SDK is published to npm or your private registry, install it by name instead:
          </p>
          <CodeBlock label="After publishing" code={`npm install ${sdkPackage.name}`} />
        </Card>

        <Card title="2. Read a flag">
          <p>
            Create the client once when your app starts, wait until it&apos;s ready, then read flags anywhere. Give every user a stable{" "}
            <code>key</code>, usually their user ID: percentage rollouts use it, so the same user always gets the same value.
          </p>
          <CodeBlock
            label="flags.ts"
            code={`import { createFlagClient } from "${sdkPackage.name}";

export const flags = createFlagClient({
  baseUrl: "${baseUrl}",
  sdkKey: "sdk-…",
  context: { key: "user-42", email: "dana@example.com", country: "IL" },
});

await flags.ready;

if (flags.getFlag("new-checkout", false)) {
  showNewCheckout();
}`}
          />
          <p>
            The second argument of <code>getFlag</code> is the fallback. You get it when the flag doesn&apos;t exist or the server
            can&apos;t be reached, so pick the value that is safe when nothing is known.
          </p>
          <p>
            Extra fields in <code>context</code>, like <code>email</code> or <code>country</code>, are what rules match on, for example
            &ldquo;IF country is IL&rdquo;.
          </p>
        </Card>

        <Card title="3. React to changes">
          <p>
            Values update by themselves. To re-render when they change, subscribe with <code>onChange</code>. It returns a function that
            unsubscribes.
          </p>
          <CodeBlock
            label="Any app"
            code={`const stop = flags.onChange(() => {
  render(flags.getFlag("banner-text", "Welcome!"));
});`}
          />
          <p>In React, put the client in a provider and read flags with a hook. This is how this app reads its own flags:</p>
          <CodeBlock
            label="FlagsProvider.tsx"
            code={`"use client";

import { createContext, use, useSyncExternalStore, type ReactNode } from "react";
import { createFlagClient, type FlagClient } from "${sdkPackage.name}";

const FlagsContext = createContext<FlagClient | null>(null);
let client: FlagClient | null = null;

export function FlagsProvider({ userKey, children }: { userKey: string; children: ReactNode }) {
  if (typeof window !== "undefined" && !client) {
    client = createFlagClient({ baseUrl: "${baseUrl}", sdkKey: "sdk-…", context: { key: userKey } });
  }
  return <FlagsContext value={client}>{children}</FlagsContext>;
}

export function useFlag<T extends string | number | boolean>(key: string, fallback: T): T {
  const flags = use(FlagsContext);
  return useSyncExternalStore(
    (onChange) => (flags ? flags.onChange(onChange) : () => {}),
    () => (flags ? flags.getFlag(key, fallback) : fallback),
    () => fallback,
  );
}`}
          />
          <CodeBlock
            label="SideMenu.tsx"
            code={`const showTest = useFlag("test", false);

return <nav>{showTest && <Link href="/test">Test</Link>}</nav>;`}
          />
        </Card>

        <Card title="4. On a server (Node.js)">
          <p>
            On a server, one client is one user. For a single user, such as a background job, create it once. For requests from many users,
            call the API below per request, or create a short-lived client without the live stream:
          </p>
          <CodeBlock
            label="server.ts"
            code={`import { createFlagClient } from "${sdkPackage.name}";

export async function flagsFor(userId: string) {
  const flags = createFlagClient({
    baseUrl: process.env.FLAGS_URL!,
    sdkKey: process.env.FLAGS_SDK_KEY!,
    context: { key: userId },
    stream: false,
  });
  await flags.ready;
  return flags;
}

const flags = await flagsFor(request.user.id);
const limit = flags.getFlag("max-upload-mb", 25);`}
          />
          <p>Keep server keys in environment variables, not in code.</p>
        </Card>

        <Card title="5. Switch user and clean up">
          <CodeBlock
            label="After login or logout"
            code={`await flags.identify({ key: "user-77", country: "US" });

flags.close();`}
          />
          <p>
            <code>identify</code> fetches the values for the new user. <code>close</code> stops the live stream; call it when the app or
            page shuts down.
          </p>
        </Card>

        <Card title="Options">
          <Table headers={["Option", "Required", "What it does"]}>
            <tr>
              <td>
                <code>baseUrl</code>
              </td>
              <td>Yes</td>
              <td>
                Address of this server, e.g. <code>{baseUrl}</code>
              </td>
            </tr>
            <tr>
              <td>
                <code>sdkKey</code>
              </td>
              <td>Yes</td>
              <td>The environment&apos;s SDK key</td>
            </tr>
            <tr>
              <td>
                <code>context</code>
              </td>
              <td>Yes</td>
              <td>
                The user: <code>key</code> plus any attributes your rules use (strings, numbers, booleans)
              </td>
            </tr>
            <tr>
              <td>
                <code>stream</code>
              </td>
              <td>No</td>
              <td>
                Live updates. Default <code>true</code>; set <code>false</code> to fetch once
              </td>
            </tr>
            <tr>
              <td>
                <code>onError</code>
              </td>
              <td>No</td>
              <td>Called with network or server errors, for your logging. The SDK itself never throws</td>
            </tr>
          </Table>
          <Table headers={["Method", "What it does"]}>
            <tr>
              <td>
                <code>ready</code>
              </td>
              <td>A promise that resolves after the first fetch, whether it worked or not</td>
            </tr>
            <tr>
              <td>
                <code>getFlag(key, fallback)</code>
              </td>
              <td>The flag&apos;s value for this user, or the fallback</td>
            </tr>
            <tr>
              <td>
                <code>allFlags()</code>
              </td>
              <td>Every flag value as an object</td>
            </tr>
            <tr>
              <td>
                <code>onChange(listener)</code>
              </td>
              <td>Runs the listener after values are fetched again; returns an unsubscribe function</td>
            </tr>
            <tr>
              <td>
                <code>identify(context)</code>
              </td>
              <td>Switches to another user and fetches their values</td>
            </tr>
            <tr>
              <td>
                <code>close()</code>
              </td>
              <td>Stops the live stream and removes listeners</td>
            </tr>
          </Table>
        </Card>

        <Card title="Without the SDK">
          <p>Any language can call the API directly. Send the SDK key in the Authorization header.</p>
          <CodeBlock
            label="Get every flag for a user"
            code={`curl -X POST ${baseUrl}/api/sdk/evaluate \\
  -H "Authorization: sdk-…" \\
  -H "Content-Type: application/json" \\
  -d '{ "context": { "key": "user-42", "country": "IL" } }'

{ "new-checkout": true, "banner-text": "Welcome!" }`}
          />
          <CodeBlock
            label="Listen for changes (Server-Sent Events)"
            code={`curl -N ${baseUrl}/api/sdk/stream -H "Authorization: sdk-…"

event: ready
data: {}

event: changed
data: {}`}
          />
          <p>
            On <code>changed</code>, call <code>/api/sdk/evaluate</code> again. A ping comes every 25 seconds to keep the connection open.
            Errors: <code>401</code> for a missing or unknown key, <code>429</code> when a key sends more than 200 requests a second.
          </p>
        </Card>
      </div>
    </Page>
  );
}
