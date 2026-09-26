import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const RBI_RATE_URL = "https://m.rbi.org.in/scripts/faqview.aspx?id=130";
const PNB_RATE_URL = "https://www.pnbhousing.com/home-loan/interest-rates";

function pageText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRate(text: string, pattern: RegExp, sourceName: string) {
  const match = text.match(pattern);
  const value = match ? Number(match[1]) : Number.NaN;

  if (!Number.isFinite(value) || value <= 0 || value >= 30) {
    throw new Error(`Could not verify ${sourceName} from its official page.`);
  }

  return value;
}

async function fetchOfficialText(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "HomeLoanCompass/1.0 rate-monitor",
    },
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw new Error(`Official source returned HTTP ${response.status}.`);
  }

  return pageText(await response.text());
}

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");
    const accessToken = authorization?.replace(/^Bearer\s+/i, "");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!accessToken || !supabaseUrl || !publishableKey) {
      return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
    }

    const body = (await request.json()) as { loanId?: string };
    if (!body.loanId) {
      return NextResponse.json({ error: "loanId is required." }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    const userResult = await supabase.auth.getUser(accessToken);
    if (userResult.error || !userResult.data.user) {
      return NextResponse.json({ error: "Your session is no longer valid." }, { status: 401 });
    }

    const loanResult = await supabase
      .from("loans")
      .select("id, current_interest_rate, benchmark_spread_percent, benchmark_name")
      .eq("id", body.loanId)
      .single();

    if (loanResult.error || !loanResult.data) {
      return NextResponse.json({ error: "Loan was not found or is not accessible." }, { status: 404 });
    }

    const [rbiText, pnbText] = await Promise.all([
      fetchOfficialText(RBI_RATE_URL),
      fetchOfficialText(PNB_RATE_URL),
    ]);

    const repoRate = parseRate(
      rbiText,
      /Policy\s*Repo\s*Rate\s*:?\s*(\d+(?:\.\d+)?)\s*%/i,
      "the RBI policy repo rate",
    );
    const benchmarkRate = parseRate(
      pnbText,
      /PNBRRR\s+for\s+Customers[\s\S]{0,300}?\bis\s+(\d+(?:\.\d+)?)\s*%/i,
      "PNB Housing PNBRRR",
    );

    const spread = loanResult.data.benchmark_spread_percent === null
      ? null
      : Number(loanResult.data.benchmark_spread_percent);
    const appliedRate = Number(loanResult.data.current_interest_rate);
    const expectedRate = spread === null ? null : benchmarkRate + spread;
    const checkedAt = new Date().toISOString();
    const observedDate = checkedAt.slice(0, 10);

    const latestResult = await supabase
      .from("rate_events")
      .select("id, rbi_repo_rate, lender_benchmark_rate, actual_applied_rate")
      .eq("loan_id", body.loanId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestResult.error) throw latestResult.error;

    const latest = latestResult.data;
    const changed =
      !latest ||
      Number(latest.rbi_repo_rate) !== repoRate ||
      Number(latest.lender_benchmark_rate) !== benchmarkRate ||
      Number(latest.actual_applied_rate) !== appliedRate;

    const snapshot = {
      loan_id: body.loanId,
      effective_date: observedDate,
      rbi_repo_rate: repoRate,
      lender_benchmark_rate: benchmarkRate,
      benchmark_spread_percent: spread,
      expected_loan_rate: expectedRate,
      actual_applied_rate: appliedRate,
      source_url: PNB_RATE_URL,
      verified_at: checkedAt,
      notes: `Automatically checked against RBI (${RBI_RATE_URL}) and PNB Housing (${PNB_RATE_URL}). Effective date is the first observed date when the official page does not publish one.`,
    };

    if (changed) {
      const insertResult = await supabase.from("rate_events").insert(snapshot);
      if (insertResult.error) throw insertResult.error;
    } else if (latest) {
      const updateResult = await supabase
        .from("rate_events")
        .update({
          expected_loan_rate: expectedRate,
          benchmark_spread_percent: spread,
          source_url: PNB_RATE_URL,
          verified_at: checkedAt,
          notes: snapshot.notes,
        })
        .eq("id", latest.id);
      if (updateResult.error) throw updateResult.error;
    }

    const historyResult = await supabase
      .from("rate_events")
      .select("rbi_repo_rate, lender_benchmark_rate, expected_loan_rate, actual_applied_rate, verified_at, source_url")
      .eq("loan_id", body.loanId)
      .order("created_at", { ascending: false })
      .limit(2);

    if (historyResult.error) throw historyResult.error;

    return NextResponse.json({
      current: historyResult.data[0] ?? null,
      previous: historyResult.data[1] ?? null,
      changed,
      sources: { rbi: RBI_RATE_URL, benchmark: PNB_RATE_URL },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not refresh official rates.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
