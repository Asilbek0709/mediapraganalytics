"use client";

/** Mijoz tomonidagi API chaqiruvlari. Server xatolari allaqachon foydalanuvchi tilida keladi. */
import { tarjimon } from "./i18n";
import { tilniOlish } from "./i18n/til";

const tr = () => tarjimon(tilniOlish(typeof document === "undefined" ? null : document.documentElement.lang));

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const matn = await res.text();
  let data: unknown = null;
  if (matn) {
    try {
      data = JSON.parse(matn);
    } catch {
      data = matn;
    }
  }
  if (!res.ok) {
    const detail = (data as { detail?: string })?.detail;
    throw new Error(typeof detail === "string" ? detail : tr().t("u.xatolik", { s: res.status }));
  }
  return data as T;
}

export const api = {
  get: <T>(url: string) => request<T>("GET", url),
  post: <T>(url: string, body?: unknown) => request<T>("POST", url, body ?? {}),
  put: <T>(url: string, body?: unknown) => request<T>("PUT", url, body ?? {}),
  del: <T>(url: string) => request<T>("DELETE", url),
};

export function xatoMatni(e: unknown): string {
  return e instanceof Error ? e.message : tr().t("u.kutilmaganXato");
}
