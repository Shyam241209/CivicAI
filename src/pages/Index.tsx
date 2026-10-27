import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, TrendingUp, Landmark, Users, Target, ArrowRight } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useTranslation } from "@/hooks/use-translation";

const Index = () => {
  const { t } = useTranslation();
  return (
    <AppLayout overlay="light">
      {/* Hero Section */}
      <section className="relative overflow-hidden min-h-[80vh] md:min-h-[90vh] flex items-center">
        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 py-8 md:py-20">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div className="text-left">
              <div className="inline-flex items-center gap-2 bg-accent/90 backdrop-blur-sm border border-accent text-accent-foreground px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs md:text-sm font-medium mb-4 md:mb-6 shadow-lg">
                <Landmark className="w-3 h-3 md:w-4 md:h-4" />
                {t("digitalIndiaInitiative")}
              </div>
              <h1 className="text-3xl md:text-5xl lg:text-7xl font-bold text-foreground mb-4 md:mb-6 leading-tight">
                {t("heroTitle")}
                <span className="block text-lg md:text-2xl lg:text-3xl font-normal mt-2 md:mt-4 text-foreground/80">
                  {t("heroSubtitle")}
                </span>
              </h1>
              <p className="text-base md:text-xl lg:text-2xl text-foreground/90 mb-6 md:mb-8 max-w-2xl leading-relaxed">
                {t("heroDescription")}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                <Button asChild size="lg" className="text-base md:text-lg px-6 md:px-8 py-5 md:py-6 bg-warning text-warning-foreground shadow-2xl hover:scale-105 transition-transform rounded-xl">
                  <Link to="/report">
                    <FileText className="mr-2 w-5 h-5" />
                    {t("reportIssue")}
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="text-base md:text-lg px-6 md:px-8 py-5 md:py-6 border-2 shadow-2xl hover:scale-105 transition-transform bg-background/80 backdrop-blur-sm rounded-xl">
                  <Link to="/dashboard">
                    <TrendingUp className="mr-2 w-5 h-5" />
                    {t("viewDashboard")}
                  </Link>
                </Button>
              </div>
            </div>
            
            {/* Stats Cards */}
            <div className="grid gap-3 md:gap-4">
              <Card className="bg-card/95 backdrop-blur-md border-2 shadow-xl hover:shadow-2xl transition-shadow rounded-2xl">
                <CardHeader className="pb-3 p-4 md:p-6">
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                    <Users className="w-5 h-5 text-warning" />
                    {t("activeCitizens")}
                  </CardTitle>
                  <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-warning to-accent bg-clip-text text-transparent">10L+</div>
                  <CardDescription>{t("acrossCities")}</CardDescription>
                </CardHeader>
              </Card>
              <Card className="bg-card/95 backdrop-blur-md border-2 shadow-xl hover:shadow-2xl transition-shadow rounded-2xl">
                <CardHeader className="pb-3 p-4 md:p-6">
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                    <Target className="w-5 h-5 text-accent" />
                    {t("issuesResolved")}
                  </CardTitle>
                  <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">5L+</div>
                  <CardDescription>{t("makingIndiaClean")}</CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Links Section */}
      <section className="py-10 md:py-16 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-3 md:mb-4">{t("getStarted")}</h2>
            <p className="text-base md:text-lg text-muted-foreground">{t("chooseParticipate")}</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4 md:gap-6">
            <Card className="group border-2 hover:border-primary hover:shadow-xl transition-all duration-300 hover:-translate-y-1 rounded-2xl">
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="text-xl md:text-2xl flex items-center gap-3">
                  <FileText className="w-6 h-6 md:w-7 md:h-7 text-primary" />
                  {t("reportAnIssue")}
                </CardTitle>
                <CardDescription className="text-sm md:text-base">
                  {t("uploadPhotoAnalyze")}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0">
                <Button asChild className="w-full rounded-xl h-11 md:h-12 text-sm md:text-base">
                  <Link to="/report">
                    {t("startReporting")} <ArrowRight className="ml-2 w-4 h-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="group border-2 hover:border-accent hover:shadow-xl transition-all duration-300 hover:-translate-y-1 rounded-2xl">
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="text-xl md:text-2xl flex items-center gap-3">
                  <TrendingUp className="w-6 h-6 md:w-7 md:h-7 text-accent" />
                  {t("learnHowItWorks")}
                </CardTitle>
                <CardDescription className="text-sm md:text-base">
                  {t("discoverPlatform")}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0">
                <Button asChild variant="outline" className="w-full rounded-xl h-11 md:h-12 text-sm md:text-base">
                  <Link to="/how-it-works">
                    {t("exploreProcess")} <ArrowRight className="ml-2 w-4 h-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </AppLayout>
  );
};

export default Index;
