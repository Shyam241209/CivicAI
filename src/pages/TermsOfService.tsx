import { AppLayout } from "@/components/AppLayout";
import { AppFooter } from "@/components/AppFooter";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const TermsOfService = () => (
  <AppLayout overlay="light">
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Button variant="ghost" size="sm" asChild className="mb-6">
        <Link to="/auth"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Link>
      </Button>
      <h1 className="text-3xl font-bold mb-6 text-foreground">Terms of Service</h1>
      <div className="prose prose-sm dark:prose-invert space-y-4 text-muted-foreground">
        <p><strong>Last updated:</strong> March 8, 2026</p>
        <h2 className="text-lg font-semibold text-foreground">1. Acceptance of Terms</h2>
        <p>By accessing and using CivicAI, you agree to be bound by these Terms of Service. If you do not agree, please do not use our platform.</p>
        <h2 className="text-lg font-semibold text-foreground">2. Use of Service</h2>
        <p>CivicAI is a civic engagement platform for reporting infrastructure issues to local authorities. You agree to use the service only for lawful purposes and to provide accurate information in your reports.</p>
        <h2 className="text-lg font-semibold text-foreground">3. User Accounts</h2>
        <p>You are responsible for maintaining the security of your account credentials. You must provide accurate information during registration and keep your account information up to date.</p>
        <h2 className="text-lg font-semibold text-foreground">4. Content Guidelines</h2>
        <p>Reports must relate to genuine civic issues. Submitting false, misleading, or abusive content may result in account suspension. Uploaded images must not contain inappropriate or illegal content.</p>
        <h2 className="text-lg font-semibold text-foreground">5. AI Analysis Disclaimer</h2>
        <p>Our AI-powered analysis provides suggestions and categorizations as a convenience. These are not guaranteed to be accurate and are subject to review by municipal authorities.</p>
        <h2 className="text-lg font-semibold text-foreground">6. Limitation of Liability</h2>
        <p>CivicAI facilitates communication between citizens and authorities but does not guarantee resolution timelines or outcomes for reported issues.</p>
        <h2 className="text-lg font-semibold text-foreground">7. Changes to Terms</h2>
        <p>We may update these terms periodically. Continued use of the service constitutes acceptance of updated terms.</p>
      </div>
    </div>
    <AppFooter />
  </AppLayout>
);

export default TermsOfService;
