import { AppLayout } from "@/components/AppLayout";
import { AppFooter } from "@/components/AppFooter";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const PrivacyPolicy = () => (
  <AppLayout overlay="light">
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Button variant="ghost" size="sm" asChild className="mb-6">
        <Link to="/auth"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Link>
      </Button>
      <h1 className="text-3xl font-bold mb-6 text-foreground">Privacy Policy</h1>
      <div className="prose prose-sm dark:prose-invert space-y-4 text-muted-foreground">
        <p><strong>Last updated:</strong> March 8, 2026</p>
        <h2 className="text-lg font-semibold text-foreground">1. Information We Collect</h2>
        <p>We collect information you provide when creating an account, submitting civic reports, and using our services. This includes your email address, location data (when permitted), and any images or descriptions you submit with reports.</p>
        <h2 className="text-lg font-semibold text-foreground">2. How We Use Your Information</h2>
        <p>Your information is used to process and route civic reports to the appropriate government departments, provide status updates on your submissions, and improve our AI-powered analysis services.</p>
        <h2 className="text-lg font-semibold text-foreground">3. Data Sharing</h2>
        <p>We share report data with relevant municipal authorities for issue resolution. We do not sell your personal information to third parties. Anonymized, aggregated data may be used for civic analytics and public dashboards.</p>
        <h2 className="text-lg font-semibold text-foreground">4. Data Security</h2>
        <p>We implement industry-standard security measures to protect your data, including encryption in transit and at rest, secure authentication, and regular security audits.</p>
        <h2 className="text-lg font-semibold text-foreground">5. Your Rights</h2>
        <p>You may request access to, correction of, or deletion of your personal data at any time by contacting us through the Help page or your account settings.</p>
        <h2 className="text-lg font-semibold text-foreground">6. Contact Us</h2>
        <p>For privacy-related inquiries, please visit our <Link to="/help" className="text-primary underline">Help page</Link>.</p>
      </div>
    </div>
    <AppFooter />
  </AppLayout>
);

export default PrivacyPolicy;
