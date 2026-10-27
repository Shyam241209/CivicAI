import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, TrendingUp, FileText, Camera, Brain, Zap, Shield, Users, ChevronRight } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useTranslation } from "@/hooks/use-translation";

const HowItWorks = () => {
  const { t } = useTranslation();

  return (
    <AppLayout overlay="medium">
      <div className="py-8 md:py-12 px-4">
        {/* Hero Section */}
        <section className="w-full mx-auto text-center mb-12 md:mb-20">
          <div className="inline-block bg-accent/10 text-accent px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs md:text-sm font-semibold mb-4 md:mb-6">
            {t("simpleProcess")}
          </div>
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4 md:mb-6">
            {t("howItWorksTitle")}
          </h1>
          <p className="text-base md:text-xl text-muted-foreground max-w-3xl mx-auto">
            {t("revolutionaryPlatform")}
          </p>
        </section>

        {/* Main Steps */}
        <section className="w-full mx-auto mb-12 md:mb-20">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
            {/* Step 1 */}
            <Card className="relative overflow-hidden border-2 hover:border-primary hover:shadow-2xl transition-all duration-300 group bg-card/95 backdrop-blur-sm rounded-2xl">
              <div className="absolute top-0 right-0 w-24 md:w-32 h-24 md:h-32 bg-primary/5 rounded-bl-[100px] group-hover:scale-150 transition-transform duration-500" />
              <CardHeader className="pb-6 md:pb-8 relative z-10 p-4 md:p-6">
                <div className="w-14 h-14 md:w-20 md:h-20 bg-gradient-to-br from-primary to-primary/60 rounded-2xl flex items-center justify-center mb-4 md:mb-6 group-hover:scale-110 transition-all shadow-lg">
                  <AlertCircle className="w-7 h-7 md:w-10 md:h-10 text-primary-foreground" />
                </div>
                <div className="text-5xl md:text-7xl font-bold text-primary/10 absolute top-4 right-4">01</div>
                <CardTitle className="text-xl md:text-3xl mb-2 md:mb-3">{t("step1Title")}</CardTitle>
                <CardDescription className="text-sm md:text-base leading-relaxed">
                  {t("spotCivicProblem")}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Camera className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-sm md:text-base mb-0.5">{t("photoUploadLabel")}</h4>
                      <p className="text-xs md:text-sm text-muted-foreground">{t("clickDragUpload")}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-sm md:text-base mb-0.5">{t("detailedDescription")}</h4>
                      <p className="text-xs md:text-sm text-muted-foreground">{t("addContextLocation")}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Step 2 */}
            <Card className="relative overflow-hidden border-2 hover:border-accent hover:shadow-2xl transition-all duration-300 group bg-card/95 backdrop-blur-sm rounded-2xl">
              <div className="absolute top-0 right-0 w-24 md:w-32 h-24 md:h-32 bg-accent/5 rounded-bl-[100px] group-hover:scale-150 transition-transform duration-500" />
              <CardHeader className="pb-6 md:pb-8 relative z-10 p-4 md:p-6">
                <div className="w-14 h-14 md:w-20 md:h-20 bg-gradient-to-br from-accent to-accent/60 rounded-2xl flex items-center justify-center mb-4 md:mb-6 group-hover:scale-110 transition-all shadow-lg">
                  <Brain className="w-7 h-7 md:w-10 md:h-10 text-accent-foreground" />
                </div>
                <div className="text-5xl md:text-7xl font-bold text-accent/10 absolute top-4 right-4">02</div>
                <CardTitle className="text-xl md:text-3xl mb-2 md:mb-3">{t("step2Title")}</CardTitle>
                <CardDescription className="text-sm md:text-base leading-relaxed">
                  {t("step2Desc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Brain className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-sm md:text-base mb-0.5">{t("smartCategorization")}</h4>
                      <p className="text-xs md:text-sm text-muted-foreground">{t("aiIdentifiesInstantly")}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <TrendingUp className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-sm md:text-base mb-0.5">{t("priorityAssessment")}</h4>
                      <p className="text-xs md:text-sm text-muted-foreground">{t("autoSeverityRating")}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Step 3 */}
            <Card className="relative overflow-hidden border-2 hover:border-warning hover:shadow-2xl transition-all duration-300 group bg-card/95 backdrop-blur-sm rounded-2xl md:col-span-2 lg:col-span-1">
              <div className="absolute top-0 right-0 w-24 md:w-32 h-24 md:h-32 bg-warning/5 rounded-bl-[100px] group-hover:scale-150 transition-transform duration-500" />
              <CardHeader className="pb-6 md:pb-8 relative z-10 p-4 md:p-6">
                <div className="w-14 h-14 md:w-20 md:h-20 bg-gradient-to-br from-warning to-warning/60 rounded-2xl flex items-center justify-center mb-4 md:mb-6 group-hover:scale-110 transition-all shadow-lg">
                  <Zap className="w-7 h-7 md:w-10 md:h-10 text-warning-foreground" />
                </div>
                <div className="text-5xl md:text-7xl font-bold text-warning/10 absolute top-4 right-4">03</div>
                <CardTitle className="text-xl md:text-3xl mb-2 md:mb-3">{t("step3Title")}</CardTitle>
                <CardDescription className="text-sm md:text-base leading-relaxed">
                  {t("monitorReport")}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-warning mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-sm md:text-base mb-0.5">{t("realTimeUpdates")}</h4>
                      <p className="text-xs md:text-sm text-muted-foreground">{t("stayInformed")}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Users className="w-5 h-5 text-warning mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-sm md:text-base mb-0.5">{t("communityImpact")}</h4>
                      <p className="text-xs md:text-sm text-muted-foreground">{t("seeHowDifference")}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Technology Section */}
        <section className="w-full mx-auto mb-12 md:mb-20">
          <Card className="border-2 bg-card/95 backdrop-blur-sm rounded-2xl">
            <CardHeader className="text-center pb-8 md:pb-12 p-4 md:p-6">
              <div className="inline-block bg-primary/10 text-primary px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs md:text-sm font-semibold mb-3 md:mb-4 mx-auto">
                {t("poweredByAI")}
              </div>
              <CardTitle className="text-2xl md:text-4xl mb-3 md:mb-4">{t("technologyBehind")}</CardTitle>
              <CardDescription className="text-sm md:text-lg">
                {t("cuttingEdgeAI")}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
              <div className="grid md:grid-cols-2 gap-6 md:gap-8">
                <div className="space-y-4">
                  <div className="flex gap-3 md:gap-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Brain className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-bold text-base md:text-lg mb-1 md:mb-2">{t("computerVisionTitle")}</h4>
                      <p className="text-sm text-muted-foreground">{t("computerVisionAccuracy")}</p>
                    </div>
                  </div>
                  <div className="flex gap-3 md:gap-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-accent/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-accent" />
                    </div>
                    <div>
                      <h4 className="font-bold text-base md:text-lg mb-1 md:mb-2">{t("smartRoutingTitle")}</h4>
                      <p className="text-sm text-muted-foreground">{t("smartRoutingFaster")}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex gap-3 md:gap-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-warning/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Zap className="w-5 h-5 md:w-6 md:h-6 text-warning" />
                    </div>
                    <div>
                      <h4 className="font-bold text-base md:text-lg mb-1 md:mb-2">{t("priorityIntelTitle")}</h4>
                      <p className="text-sm text-muted-foreground">{t("priorityIntelML")}</p>
                    </div>
                  </div>
                  <div className="flex gap-3 md:gap-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-success/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Shield className="w-5 h-5 md:w-6 md:h-6 text-success" />
                    </div>
                    <div>
                      <h4 className="font-bold text-base md:text-lg mb-1 md:mb-2">{t("dataSecurityTitle")}</h4>
                      <p className="text-sm text-muted-foreground">{t("dataSecurityEncrypt")}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* CTA Section */}
        <section className="max-w-4xl mx-auto text-center">
          <Card className="border-2 border-primary/20 bg-card/95 backdrop-blur-sm overflow-hidden rounded-2xl">
            <CardContent className="p-6 md:p-12">
              <h2 className="text-2xl md:text-4xl font-bold mb-4 md:mb-6">{t("readyGetStarted")}</h2>
              <p className="text-base md:text-xl text-muted-foreground mb-6 md:mb-8 max-w-2xl mx-auto">
                {t("joinMillions")}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center">
                <Button asChild size="lg" className="text-base md:text-lg px-6 md:px-8 py-5 md:py-6 rounded-xl">
                  <Link to="/report">
                    <FileText className="mr-2 w-5 h-5" />
                    {t("reportFirstIssue")}
                    <ChevronRight className="ml-2 w-5 h-5" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="text-base md:text-lg px-6 md:px-8 py-5 md:py-6 rounded-xl">
                  <Link to="/dashboard">{t("viewDashboard")}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </AppLayout>
  );
};

export default HowItWorks;
