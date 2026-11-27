import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IconJob } from "@/app/types";
import { companyLog } from "@/lib/logs";
import { prisma } from "@/lib/prisma";
import { createCompany } from "@/test/factory";
import { processIconJob, removeCompanyIcon, setCompanyIcon } from "./company-icon";

const files = vi.hoisted(() => new Map<string, Buffer>());
const queued = vi.hoisted(() => [] as IconJob[]);

vi.mock("./storage", () => ({
  putFile: async (key: string, body: Buffer) => {
    files.set(key, body);
    return `/api/uploads/${key}`;
  },
  getFile: async (key: string) => files.get(key) ?? null,
  fileExists: async (key: string) => files.has(key),
  deleteFile: async (key: string) => {
    files.delete(key);
  },
  deleteFileByUrl: async (url: string | null) => {
    if (url?.startsWith("/api/uploads/")) files.delete(url.slice("/api/uploads/".length));
  },
  createImageUpload: async (key: string) => ({ key, url: "http://s3.test/bucket", fields: {} }),
}));

vi.mock("./icon-queue", () => ({
  sendIconJob: async (job: IconJob) => {
    queued.push(job);
  },
}));

const png = () =>
  sharp({ create: { width: 200, height: 100, channels: 3, background: "#3366ff" } })
    .png()
    .toBuffer();

const uploadKey = (userId: string) => `uploads/${userId}/${crypto.randomUUID()}`;

const iconOf = (companyId: string) =>
  prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { iconUrl: true, iconThumbUrl: true, iconStatus: true, iconSourceKey: true },
  });

beforeEach(() => {
  files.clear();
  queued.length = 0;
});

describe("setCompanyIcon", () => {
  it("marks the icon as processing and queues a job", async () => {
    const world = await createCompany();
    const key = uploadKey(world.admin.id);
    files.set(key, await png());

    await setCompanyIcon(world.company, { key, uploadedBy: world.admin.id }, companyLog(world.asSessionUser(world.admin, "ADMIN")));

    expect(await iconOf(world.company.id)).toMatchObject({ iconStatus: "PROCESSING", iconSourceKey: key });
    expect(queued).toEqual([{ companyId: world.company.id, key }]);
  });

  it("refuses an upload made by another user", async () => {
    const world = await createCompany();
    const key = uploadKey(world.editor.id);
    files.set(key, await png());

    await expect(
      setCompanyIcon(world.company, { key, uploadedBy: world.admin.id }, companyLog(world.asSessionUser(world.admin, "ADMIN"))),
    ).rejects.toThrow("That upload isn't yours");
    expect(queued).toEqual([]);
  });

  it("refuses an upload that never reached storage", async () => {
    const world = await createCompany();

    await expect(
      setCompanyIcon(
        world.company,
        { key: uploadKey(world.admin.id), uploadedBy: world.admin.id },
        companyLog(world.asSessionUser(world.admin, "ADMIN")),
      ),
    ).rejects.toThrow("The upload didn't finish");
  });
});

describe("processIconJob", () => {
  async function queuedIcon(original: Buffer) {
    const world = await createCompany();
    const key = uploadKey(world.admin.id);
    files.set(key, original);
    await setCompanyIcon(world.company, { key, uploadedBy: world.admin.id }, companyLog(world.asSessionUser(world.admin, "ADMIN")));
    return { world, job: { companyId: world.company.id, key } };
  }

  it("makes both sizes, saves them and deletes the original", async () => {
    const { world, job } = await queuedIcon(await png());

    await processIconJob(job);

    const icon = await iconOf(world.company.id);
    expect(icon).toMatchObject({ iconStatus: "READY", iconSourceKey: null });
    const thumb = files.get(icon.iconThumbUrl!.slice("/api/uploads/".length))!;
    expect(await sharp(thumb).metadata()).toMatchObject({ format: "webp", width: 64, height: 64 });
    expect(files.has(job.key)).toBe(false);
  });

  it("replaces the old icon files", async () => {
    const { world, job } = await queuedIcon(await png());
    await processIconJob(job);
    const first = await iconOf(world.company.id);

    const second = uploadKey(world.admin.id);
    files.set(second, await png());
    await setCompanyIcon(world.company, { key: second, uploadedBy: world.admin.id }, companyLog(world.asSessionUser(world.admin, "ADMIN")));
    await processIconJob({ companyId: world.company.id, key: second });

    expect([...files.keys()]).not.toContain(first.iconUrl!.slice("/api/uploads/".length));
    expect((await iconOf(world.company.id)).iconUrl).not.toBe(first.iconUrl);
  });

  it("marks the icon as failed when the file isn't an image", async () => {
    const { world, job } = await queuedIcon(Buffer.from("not an image"));

    await processIconJob(job);

    expect(await iconOf(world.company.id)).toMatchObject({ iconStatus: "FAILED", iconSourceKey: null, iconUrl: null });
    expect(files.has(job.key)).toBe(false);
  });

  it("skips a job that a newer upload replaced", async () => {
    const { world, job } = await queuedIcon(await png());
    const newer = uploadKey(world.admin.id);
    files.set(newer, await png());
    await setCompanyIcon(world.company, { key: newer, uploadedBy: world.admin.id }, companyLog(world.asSessionUser(world.admin, "ADMIN")));

    await processIconJob(job);

    expect(await iconOf(world.company.id)).toMatchObject({ iconStatus: "PROCESSING", iconSourceKey: newer });
    expect(files.has(job.key)).toBe(false);
  });

  it("does nothing the second time the same job arrives", async () => {
    const { world, job } = await queuedIcon(await png());
    await processIconJob(job);
    const icon = await iconOf(world.company.id);

    await processIconJob(job);

    expect(await iconOf(world.company.id)).toEqual(icon);
  });

  it("drops a job when the icon was removed meanwhile", async () => {
    const { world, job } = await queuedIcon(await png());
    await removeCompanyIcon(world.company, companyLog(world.asSessionUser(world.admin, "ADMIN")));

    await processIconJob(job);

    expect(await iconOf(world.company.id)).toMatchObject({ iconStatus: null, iconUrl: null });
    expect(files.size).toBe(0);
  });
});
