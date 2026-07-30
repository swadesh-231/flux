import ClosingCta from "@/components/landing/ClosingCta";
import Features from "@/components/landing/Features";
import Hero from "@/components/landing/Hero";
import Pricing from "@/components/landing/Pricing";
import Workflow from "@/components/landing/Workflow";
import WorkspacePreview from "@/components/landing/WorkspacePreview";

export default function Home() {
  return (
    <>
      <Hero />
      <WorkspacePreview />
      <Features />
      <Workflow />
      <Pricing />
      <ClosingCta />
    </>
  );
}
