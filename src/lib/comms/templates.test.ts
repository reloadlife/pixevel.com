import { describe, expect, test } from "vitest";

import { renderContent } from "./templates";

describe("renderContent", () => {
  test("EMAIL: interpolates subject, escapes body var values, wraps in shell", () => {
    const r = renderContent(
      "EMAIL",
      { subject: "سفارش {order_number}", body: "<p>{note}</p>", bodyText: "سفارش {order_number}" },
      "tid-1",
      { order_number: "PX-1", note: "<b>x</b>" },
    );
    expect(r.subject).toBe("سفارش PX-1");
    expect(r.html).toContain("&lt;b&gt;x&lt;/b&gt;"); // value HTML-escaped
    expect(r.html).toContain("<!doctype html>"); // wrapped in shell chrome
    expect(r.text).toBe("سفارش PX-1");
    expect(r.templateId).toBe("tid-1");
    expect(r.isPattern).toBe(false);
  });

  test("SMS: raw interpolation, unknown var → blank, isPattern passthrough, no html", () => {
    const r = renderContent(
      "SMS",
      { body: "سفارش {order_number} {missing}", isPattern: true },
      null,
      { order_number: "PX-2" },
    );
    expect(r.text).toBe("سفارش PX-2 "); // {missing} → ""
    expect(r.isPattern).toBe(true);
    expect(r.html).toBeNull();
    expect(r.subject).toBeNull();
  });

  test("INAPP: subject becomes the title, body is plain text (not escaped)", () => {
    const r = renderContent("INAPP", { subject: "عنوان {x}", body: "متن <b>{x}</b>" }, null, {
      x: "۱",
    });
    expect(r.subject).toBe("عنوان ۱");
    expect(r.text).toBe("متن <b>۱</b>"); // INAPP is plain text, value not escaped
  });
});
