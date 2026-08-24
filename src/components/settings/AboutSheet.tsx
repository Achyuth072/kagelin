"use client";

import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import { IconCell } from "@/components/ui/IconCell";
import { PreviewBadge } from "@/components/ui/PreviewBadge";
import {
  Info,
  Sparkles,
  GitBranch,
  Bug,
  Scale,
  Shield,
  FileText,
  Package,
  ExternalLink,
} from "lucide-react";
import { GitHubIcon } from "@/components/auth/ProviderIcons";
import { REPO_URL, PRIVACY_URL, TERMS_URL } from "@/lib/links";
import { ICON_LED_ROW_CLASS } from "@/components/settings/iconLedRowClass";
import { cn } from "@/lib/utils";

interface AboutSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  version: string;
  onOpenChangelog: () => void;
}

const ROW_CLASS = cn(ICON_LED_ROW_CLASS, "w-full text-left");

function AboutRow({
  icon: Icon,
  label,
  detail,
  href,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  detail: string;
  href?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <IconCell className="items-center pt-0">
        <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={2.25} />
      </IconCell>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{detail}</p>
      </div>
      {href && (
        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
      )}
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={ROW_CLASS}
      >
        {content}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={ROW_CLASS}>
      {content}
    </button>
  );
}

export function AboutSheet({
  open,
  onOpenChange,
  version,
  onOpenChangelog,
}: AboutSheetProps) {
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-110 border-border/80 shadow-none p-0 overflow-hidden flex flex-col max-h-[85dvh] sm:max-h-[90dvh]">
        <ResponsiveDialogHeader className="p-6 pb-3 border-b border-border/80 shrink-0">
          <ResponsiveDialogTitle className="flex items-center gap-2.5 text-[20px] font-semibold tracking-[-0.02em] text-foreground">
            <Info className="h-4.5 w-4.5 text-muted-foreground" />
            About Kagelin
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.01em] text-foreground pt-1">
            v{version}
            <PreviewBadge version={version} />
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide p-3 space-y-0.5">
          <AboutRow
            icon={Sparkles}
            label="What's New"
            detail="Recent changes and releases"
            onClick={onOpenChangelog}
          />
          {/* AGPL-3.0 §13: must offer the source of the exact running version, not HEAD. */}
          <AboutRow
            icon={GitBranch}
            label={`Source (v${version})`}
            detail="This exact build on GitHub"
            href={`${REPO_URL}/tree/v${version}`}
          />
          <AboutRow
            icon={GitHubIcon}
            label="Source code"
            detail="github.com/Achyuth072/kagelin"
            href={REPO_URL}
          />
          <AboutRow
            icon={Bug}
            label="Report an Issue"
            detail="File a bug or feature request"
            href={`${REPO_URL}/issues`}
          />
          <AboutRow
            icon={Scale}
            label="License"
            detail="AGPL-3.0-only"
            href={`${REPO_URL}/blob/v${version}/LICENSE`}
          />
          <AboutRow
            icon={Shield}
            label="Privacy Policy"
            detail="kagelin.app/privacy"
            href={PRIVACY_URL}
          />
          <AboutRow
            icon={FileText}
            label="Terms of Service"
            detail="kagelin.app/terms"
            href={TERMS_URL}
          />
          <AboutRow
            icon={Package}
            label="Open-source software"
            detail="Full list of dependencies"
            href={`${REPO_URL}/blob/v${version}/package.json`}
          />
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
