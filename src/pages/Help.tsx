import { AppLayout } from "@/components/AppLayout";
import { AppFooter } from "@/components/AppFooter";
import { ArrowLeft, Mail, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Help = () => (
  <AppLayout overlay="light">
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Button variant="ghost" size="sm" asChild className="mb-6">
        <Link to="/auth"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Link>
      </Button>
      <h1 className="text-3xl font-bold mb-2 text-foreground">Help Center</h1>
      <p className="text-muted-foreground mb-8">Find answers to common questions or get in touch with our support team.</p>

      <div className="grid gap-4 sm:grid-cols-2 mb-10">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="w-4 h-4 text-primary" /> Email Support
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Reach us at <span className="text-primary font-medium">support@civicai.app</span> and we'll respond within 24 hours.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="w-4 h-4 text-primary" /> Community Forum
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Connect with other citizens and share tips on effective civic reporting.</p>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-xl font-semibold mb-4 text-foreground">Frequently Asked Questions</h2>
      <div className="space-y-4">
        {[
          { q: "How do I submit a civic report?", a: "Sign in, navigate to 'Report Issue', add a photo or description of the problem, and our AI will help categorize and route it to the right department." },
          { q: "Can I track the status of my report?", a: "Yes! Visit your Dashboard to see real-time status updates on all your submitted reports." },
          { q: "Is my personal information shared publicly?", a: "No. Your identity is kept confidential. Only relevant municipal authorities can see report details. See our Privacy Policy for more information." },
          { q: "How does the AI analysis work?", a: "Our AI examines your report's photo and description to suggest a category, severity level, and the most appropriate department to handle the issue." },
          { q: "Can I edit or delete a submitted report?", a: "You can view your reports on the Dashboard. Contact support if you need to modify or remove a submission." },
        ].map(({ q, a }) => (
          <div key={q} className="border border-border rounded-lg p-4">
            <h3 className="font-medium text-foreground mb-1">{q}</h3>
            <p className="text-sm text-muted-foreground">{a}</p>
          </div>
        ))}
      </div>

    </div>
    <AppFooter />
  </AppLayout>
);

export default Help;
