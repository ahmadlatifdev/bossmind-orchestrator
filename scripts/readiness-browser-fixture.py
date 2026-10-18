#!/usr/bin/env python3
"""Verify the Playwright harness against an ephemeral synthetic local fixture.

This is tool/harness evidence only. It does not test Resumora, Stripe, production
authorization, a real account, an AI provider, or an existing BossMind workflow.
No persistent application service or store is created. External requests are
blocked; only the randomly assigned loopback port is allowed.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import importlib.metadata
import json
from pathlib import Path
import secrets
import tempfile
import threading
import time
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / 'Server/tests/fixtures/readiness-client.html'
FIXTURE_TEXT = 'SYNTHETIC RESUME\nExample Candidate\nReviewed fixture content only.\n'


class FixtureServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self):
        super().__init__(('127.0.0.1', 0), Handler)
        self.session_id = secrets.token_urlsafe(24)
        self.authenticated = False
        self.entitled = False
        self.production_access = False
        self.generated = 0
        self.post_count = 0


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass  # Do not log bodies, sessions, passwords or authentication cookies.

    def reply(self, status, value, extra_headers=()):
        payload = json.dumps(value).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(payload)))
        for name, value in extra_headers:
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(payload)

    def signed_in(self):
        cookie = SimpleCookie()
        cookie.load(self.headers.get('Cookie', ''))
        return (self.server.authenticated and 'fixture_session' in cookie
                and secrets.compare_digest(cookie['fixture_session'].value, self.server.session_id))

    def do_GET(self):
        if self.path != '/':
            return self.reply(404, {'code': 'NOT_FOUND'})
        payload = FIXTURE.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'")
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_POST(self):
        self.server.post_count += 1
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length < 0 or length > 4096:
                return self.reply(413, {'code': 'BODY_TOO_LARGE'})
            body = json.loads(self.rfile.read(length))
        except (ValueError, json.JSONDecodeError):
            return self.reply(400, {'code': 'BAD_REQUEST'})
        if self.path == '/fixture/session':
            if body != {'email': 'qa@example.invalid', 'password': 'synthetic-only'}:
                return self.reply(401, {'code': 'FIXTURE_AUTH_REQUIRED'})
            self.server.authenticated = True
            return self.reply(200, {'signedIn': True}, [('Set-Cookie', f'fixture_session={self.server.session_id}; HttpOnly; SameSite=Strict; Path=/')])
        if not self.signed_in():
            return self.reply(401, {'code': 'SIGN_IN_REQUIRED'})
        if self.path == '/fixture/payment':
            # This is not a Stripe emulator. It is an explicit harness-negative
            # fixture, proving the assertion catches a mode mismatch outcome.
            if body.get('destination') != 'fixture' or body.get('mode') != 'test':
                return self.reply(409, {'code': 'MODE_MISMATCH', 'productionAccess': False})
            self.server.entitled = True
            return self.reply(200, {'fixtureEntitlement': True, 'productionAccess': False})
        if self.path == '/fixture/generate':
            if not self.server.entitled:
                return self.reply(403, {'code': 'ENTITLEMENT_REQUIRED'})
            if body.get('plan') not in ('basic', 'pro', 'business'):
                return self.reply(400, {'code': 'INVALID_PLAN'})
            self.server.generated += 1
            return self.reply(200, {'text': FIXTURE_TEXT, 'synthetic': True})
        return self.reply(404, {'code': 'NOT_FOUND'})


def run(chromium):
    server = FixtureServer()
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    origin = f'http://127.0.0.1:{server.server_port}'
    checks, external_attempts = [], []
    started = time.monotonic()
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=chromium, headless=True,
                                                  args=['--no-sandbox', '--disable-background-networking'])
            context = browser.new_context(accept_downloads=True, service_workers='block')

            def restrict(route):
                if route.request.url.startswith(origin + '/'):
                    return route.continue_()
                external_attempts.append(route.request.resource_type)
                return route.abort('blockedbyclient')

            context.route('**/*', restrict)
            page = context.new_page()
            page.goto(origin, wait_until='domcontentloaded')
            expect(page.get_by_role('heading', name='Synthetic readiness harness')).to_be_visible()

            # A button click alone is insufficient: inspect the returned outcome.
            page.locator('#generate').click()
            expect(page.locator('#status')).to_have_text('SIGN_IN_REQUIRED')
            assert server.generated == 0
            checks.append({'id': 'anonymous-delivery-denied', 'status': 'PASS', 'observed': 'HTTP 401; no generated result'})

            before = server.post_count
            page.get_by_role('button', name='Sign in', exact=True).click()
            assert page.locator('#email').evaluate('(element) => element.validity.valueMissing')
            assert server.post_count == before
            checks.append({'id': 'required-form-validation', 'status': 'PASS', 'observed': 'Empty email prevented the session request'})

            page.locator('#email').fill('qa@example.invalid')
            page.locator('#password').fill('synthetic-only')
            page.get_by_role('button', name='Sign in', exact=True).click()
            expect(page.locator('#session')).to_have_text('Signed in (synthetic fixture)')
            checks.append({'id': 'synthetic-sign-in-outcome', 'status': 'PASS', 'observed': 'Authenticated fixture state displayed'})

            page.locator('#plan').select_option('pro')
            expect(page.locator('#amount')).to_have_text('USD 49.00 one-time')
            checks.append({'id': 'plan-amount-outcome', 'status': 'PASS', 'observed': 'Selecting Pro displayed USD 49.00 one-time'})

            page.locator('#generate').click()
            expect(page.locator('#status')).to_have_text('ENTITLEMENT_REQUIRED')
            assert server.generated == 0
            checks.append({'id': 'no-entitlement-delivery-denied', 'status': 'PASS', 'observed': 'HTTP 403; no generated result'})

            rejected = context.request.post(origin + '/fixture/payment', data={'mode': 'test', 'destination': 'production'})
            assert rejected.status == 409 and rejected.json()['productionAccess'] is False
            assert server.entitled is False and server.production_access is False
            checks.append({'id': 'test-mode-production-grant-denied', 'status': 'PASS', 'observed': 'Synthetic negative fixture returned HTTP 409; access stayed false'})

            granted = context.request.post(origin + '/fixture/payment', data={'mode': 'test', 'destination': 'fixture'})
            assert granted.status == 200 and granted.json()['productionAccess'] is False
            page.locator('#generate').click()
            expect(page.locator('#status')).to_have_text('Result delivered')
            expect(page.locator('#result')).to_have_text(FIXTURE_TEXT.strip())
            with page.expect_download() as info:
                page.get_by_role('button', name='Download fixture text').click()
            download = info.value
            with tempfile.TemporaryDirectory(prefix='readiness-download-') as directory:
                target = Path(directory) / 'result.txt'
                download.save_as(target)
                actual = target.read_bytes()
            assert actual == FIXTURE_TEXT.encode()
            assert server.generated == 1
            checks.append({'id': 'delivered-download-bytes', 'status': 'PASS',
                           'observed': 'Actual browser download exactly matched the generated synthetic text',
                           'bytes': len(actual), 'sha256': hashlib.sha256(actual).hexdigest()})

            # Prove this browser context denies attempted egress. The URL is a
            # reserved .invalid address, intercepted before DNS or transport.
            result = page.evaluate("fetch('https://egress-check.invalid/no-network').then(() => 'unexpected').catch(() => 'blocked')")
            assert result == 'blocked'
            checks.append({'id': 'browser-egress-denied', 'status': 'PASS', 'observed': 'External fetch blocked before transport'})
            version = browser.version
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)
    return {
        'schemaVersion': 1, 'scope': 'SYNTHETIC_FIXTURE_ONLY', 'status': 'PASS',
        'observedAt': datetime.now(timezone.utc).isoformat(),
        'productionAcceptance': False,
        'limitations': [
            'No Resumora application code, real account, checkout, provider, or deployed endpoint was tested.',
            'This verifies browser harness assertions, not production authorization or payment security.',
            'No DBOS integration, shared capacity, existing grants, or remote event publication is proven by this fixture.'
        ],
        'tools': {'playwrightPython': importlib.metadata.version('playwright'), 'chromium': version},
        'profile': {'environment': 'ephemeral-loopback-fixture', 'browser': 'chromium-headless',
                    'locale': 'en-US', 'viewport': {'width': 1280, 'height': 720}},
        'sourceSha256': {'harness': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                         'fixture': hashlib.sha256(FIXTURE.read_bytes()).hexdigest()},
        'checks': checks, 'passed': len(checks), 'failed': 0,
        'externalRequestsAllowed': 0, 'externalAttemptsBlocked': len(external_attempts),
        'realPayments': 0, 'modelCalls': 0, 'screenshots': 0, 'traces': 0,
        'elapsedMs': round((time.monotonic() - started) * 1000)
    }


def run_dashboard(chromium, dashboard):
    """Exercise the real dashboard HTML with explicit, synthetic API replies.

    Responses are intercepted before any transport. This tests browser behavior,
    not the actual route authorization or production integration behind it.
    """
    source_bytes = dashboard.read_bytes()
    source = source_bytes.decode('utf-8')
    origin = 'http://127.0.0.1:49877'
    checks = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=chromium, headless=True,
                                              args=['--no-sandbox', '--disable-background-networking'])
        for role, integrated in [('reader', True), ('owner', False), ('owner', True)]:
            context = browser.new_context(service_workers='block')
            bootstrap = {'canRun': role == 'owner', 'canSchedule': False,
                         'csrfToken': 'synthetic-csrf-only' if role == 'owner' else None}
            html = source.replace('__READINESS_BOOTSTRAP__', json.dumps(bootstrap)).replace('__READINESS_NONCE__', 'synthetic-fixture')
            requests = []
            report = {
                'enabled': integrated,
                'integration': {'status': 'VERIFIED' if integrated else 'BLOCKED',
                                'missing': [] if integrated else ['existing worker hooks']},
                'projects': [{
                    'id': 'fixture', 'repository': 'synthetic/fixture', 'commit': 'fixture-version',
                    'environment': 'synthetic', 'verdict': 'NO-GO',
                    'counts': {'PASS': 0, 'FAIL': 0, 'BLOCKED': 1, 'OUTDATED': 1},
                    'checks': [
                        {'id': 'unavailable-service', 'tool': 'playwright', 'critical': True,
                         'status': 'BLOCKED', 'reason': '<img src=x onerror="window.__readinessXss=1">',
                         'findings': {'message': '<script>window.__readinessXss=1</script>', 'oversized': 'x' * 25000},
                         'evidence': {'url': 'javascript:window.__readinessXss=1'}},
                        {'id': 'expired-evidence', 'tool': 'trivy', 'critical': True,
                         'status': 'OUTDATED', 'reason': 'Source version changed',
                         'evidence': {'url': '/api/readiness/evidence/fixture/synthetic-execution/expired-evidence',
                                      'observedAt': '2026-01-01T00:00:00Z', 'commit': 'old-fixture-version'}}
                    ]
                }],
                'tools': [{'id': 'playwright', 'status': 'VERIFIED', 'reason': 'Synthetic harness only'}]
            }

            def mock(route):
                request = route.request
                if not request.url.startswith(origin + '/'):
                    return route.abort('blockedbyclient')
                requests.append({'method': request.method, 'path': request.url[len(origin):]})
                if request.url == origin + '/readiness':
                    return route.fulfill(status=200, content_type='text/html', body=html)
                if request.url == origin + '/api/readiness' and request.method == 'GET':
                    return route.fulfill(status=200, content_type='application/json', body=json.dumps(report))
                if request.url == origin + '/api/readiness/fixture/runs' and request.method == 'POST':
                    assert role == 'owner' and integrated
                    assert request.headers.get('x-csrf-token') == 'synthetic-csrf-only'
                    assert json.loads(request.post_data) == {}
                    return route.fulfill(status=202, content_type='application/json', body='{"accepted":true}')
                return route.fulfill(status=404, content_type='application/json', body='{"code":"NOT_FOUND"}')

            context.route('**/*', mock)
            page = context.new_page()
            page.goto(origin + '/readiness', wait_until='domcontentloaded')
            expect(page.locator('#load-status')).to_have_text('Saved evidence refreshed. No check was started.')
            expect(page.locator('[data-testid="summary"]')).to_contain_text('1 NO-GO')
            expect(page.locator('#projects')).to_contain_text('OUTDATED')
            assert page.locator('#projects img').count() == 0
            assert page.locator('#projects script').count() == 0
            assert page.evaluate('window.__readinessXss === undefined')
            assert page.locator('a[href^="javascript:"]').count() == 0
            assert page.get_by_role('link', name='Open evidence').get_attribute('href') == origin + '/api/readiness/evidence/fixture/synthetic-execution/expired-evidence'
            findings = page.locator('#projects pre').text_content()
            assert '<script>window.__readinessXss=1</script>' in findings
            assert len(findings) <= 20000 and findings.endswith('…truncated')
            run_button = page.locator('button[data-action="run"]')
            expect(page.locator('button[data-action="schedule"]')).to_be_disabled()
            if role != 'owner' or not integrated:
                expect(run_button).to_be_disabled()
                assert all(request['method'] == 'GET' for request in requests)
                checks.append({'id': f'dashboard-{role}-{str(integrated).lower()}-mutation-disabled',
                               'status': 'PASS', 'observed': 'Run and scheduling controls disabled; no mutation request'})
            else:
                expect(run_button).to_be_enabled()
                run_button.click()
                expect(page.locator('#load-status')).to_have_text('Run accepted by the existing worker queue. Refresh evidence after it completes.')
                assert len([request for request in requests if request['method'] == 'POST']) == 1
                checks.append({'id': 'dashboard-owner-guarded-submit-shape', 'status': 'PASS',
                               'observed': 'One mock run request carried the expected CSRF header and empty body; no production job started'})
            before = len(requests)
            page.locator('#refresh').click()
            expect(page.locator('#load-status')).to_have_text('Saved evidence refreshed. No check was started.')
            assert len(requests) == before + 1 and requests[-1] == {'method': 'GET', 'path': '/api/readiness'}
            context.close()
        browser.close()
    checks.append({'id': 'dashboard-safe-rendering-and-evidence-links', 'status': 'PASS',
                   'observed': 'Untrusted content remained text; executable evidence URLs were rejected; safe same-origin link retained'})
    checks.append({'id': 'dashboard-read-only-refresh', 'status': 'PASS',
                   'observed': 'Each Refresh issued one GET only, with no scan or model endpoint'})
    checks.append({'id': 'dashboard-findings-safe-and-bounded', 'status': 'PASS',
                   'observed': 'Normalized script-like findings remained literal text; oversized findings were truncated below 20000 characters'})
    return {'scope': 'DASHBOARD_WITH_SYNTHETIC_API_ONLY', 'status': 'PASS',
            'passed': len(checks), 'failed': 0, 'checks': checks,
            'sourceSha256': hashlib.sha256(source_bytes).hexdigest(),
            'limitations': ['No actual route permission enforcement, queue, DBOS, provider, or deployed dashboard was exercised.']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--chromium', default='/usr/bin/chromium')
    parser.add_argument('--output', default=str(ROOT / 'docs/readiness-evidence/browser-fixture.json'))
    parser.add_argument('--dashboard', help='Optionally test this dashboard HTML with intercepted synthetic API responses')
    args = parser.parse_args()
    destination = Path(args.output).resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    if not Path(args.chromium).is_file():
        destination.write_text(json.dumps({'schemaVersion': 1, 'scope': 'SYNTHETIC_FIXTURE_ONLY',
            'status': 'BLOCKED', 'productionAcceptance': False,
            'observedAt': datetime.now(timezone.utc).isoformat(),
            'reason': 'Chromium executable unavailable'}, indent=2) + '\n')
        raise SystemExit('BLOCKED: Chromium executable unavailable')
    try:
        report = run(args.chromium)
        if args.dashboard:
            report['dashboard'] = run_dashboard(args.chromium, Path(args.dashboard).resolve())
    except Exception as error:
        # A failed rerun must not leave a previous PASS artifact behind. Only the
        # error category is recorded; arbitrary exception text is not published.
        destination.write_text(json.dumps({'schemaVersion': 1, 'scope': 'SYNTHETIC_FIXTURE_ONLY',
            'status': 'FAIL', 'productionAcceptance': False,
            'observedAt': datetime.now(timezone.utc).isoformat(),
            'reason': 'Fixture run did not complete', 'errorCategory': type(error).__name__}, indent=2) + '\n')
        raise SystemExit('FAIL: synthetic browser fixture did not complete') from None
    # Evidence contains only safe summaries and fixed synthetic content hashes.
    destination.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'scope': report['scope'], 'status': report['status'], 'passed': report['passed'],
                      'failed': report['failed'], 'tools': report['tools'],
                      'dashboardPassed': report.get('dashboard', {}).get('passed', 0),
                      'externalRequestsAllowed': 0, 'modelCalls': 0, 'realPayments': 0}))


if __name__ == '__main__':
    main()
