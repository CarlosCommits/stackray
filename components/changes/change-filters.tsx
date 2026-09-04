"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldGroup } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ChangeCategory } from "@/lib/contracts/changes";

export type ChangeFeedFilters = {
  target: string | null;
  category: ChangeCategory | null;
};

type EditableChangeFilters = {
  target: string;
  category: ChangeCategory | "all";
};

const SEARCH_DEBOUNCE_MS = 275;

const categoryOptions: Array<{ value: ChangeCategory; label: string }> = [
  { value: "availability", label: "Availability" },
  { value: "content", label: "Content" },
  { value: "infrastructure", label: "Infrastructure" },
  { value: "tls", label: "TLS" },
  { value: "technology", label: "Technology" },
  { value: "discovery", label: "Discovery" },
  { value: "security", label: "Security" },
];

function toEditableFilters(filters: ChangeFeedFilters): EditableChangeFilters {
  return {
    target: filters.target ?? "",
    category: filters.category ?? "all",
  };
}

export function buildChangeFiltersHref(filters: EditableChangeFilters, basePath = "/changes") {
  const params = new URLSearchParams();
  const target = filters.target.trim();

  if (target) {
    params.set("target", target);
  }
  if (filters.category !== "all") {
    params.set("category", filters.category);
  }
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function ChangeFilters({
  initialFilters,
  basePath = "/changes",
  showTargetSearch = true,
  surface = true,
}: {
  initialFilters: ChangeFeedFilters;
  basePath?: string;
  showTargetSearch?: boolean;
  surface?: boolean;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState(() => toEditableFilters(initialFilters));
  const [isPending, startTransition] = useTransition();
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSearchTimer = useCallback(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }
  }, []);

  const applyFilters = useCallback((nextFilters: EditableChangeFilters) => {
    startTransition(() => {
      router.replace(buildChangeFiltersHref(nextFilters, basePath), { scroll: false });
    });
  }, [basePath, router]);

  useEffect(() => clearSearchTimer, [clearSearchTimer]);

  const updateSelection = (
    key: "category",
    value: EditableChangeFilters[typeof key],
  ) => {
    clearSearchTimer();
    const nextFilters = { ...filters, [key]: value };
    setFilters(nextFilters);
    applyFilters(nextFilters);
  };

  const updateSearch = (target: string) => {
    const nextFilters = { ...filters, target };
    setFilters(nextFilters);
    clearSearchTimer();
    searchTimerRef.current = setTimeout(() => applyFilters(nextFilters), SEARCH_DEBOUNCE_MS);
  };

  const clearSearch = () => {
    clearSearchTimer();
    const nextFilters = { ...filters, target: "" };
    setFilters(nextFilters);
    applyFilters(nextFilters);
  };

  const clearFilters = () => {
    clearSearchTimer();
    const nextFilters: EditableChangeFilters = { target: "", category: "all" };
    setFilters(nextFilters);
    applyFilters(nextFilters);
  };

  const hasFilters = Boolean(filters.target.trim() || filters.category !== "all");
  const selectedCategoryLabel = filters.category === "all"
    ? "All categories"
    : categoryOptions.find((option) => option.value === filters.category)?.label ?? "All categories";

  const controls = (
    <FieldGroup className={showTargetSearch ? "gap-2.5 sm:grid sm:grid-cols-[minmax(14rem,1fr)_12rem_auto]" : "w-full gap-2.5 sm:grid sm:w-auto sm:grid-cols-[12rem_auto]"}>
          {showTargetSearch ? <Field className="sm:col-span-2 lg:col-span-1">
            <span className="sr-only">Search targets</span>
            <InputGroup className="h-9">
              <InputGroupInput
                type="search"
                value={filters.target}
                onChange={(event) => updateSearch(event.currentTarget.value)}
                placeholder="Search targets"
                aria-label="Search targets"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
              />
              <InputGroupAddon align="inline-start"><Search aria-hidden="true" /></InputGroupAddon>
              {filters.target ? (
                <InputGroupAddon align="inline-end">
                  <Button type="button" variant="ghost" size="icon-xs" aria-label="Clear search" onClick={clearSearch}>
                    <X aria-hidden="true" />
                  </Button>
                </InputGroupAddon>
              ) : null}
            </InputGroup>
          </Field> : null}
          <Field>
            <span className="sr-only">Category</span>
            <Select
              value={filters.category}
              onValueChange={(value) => updateSelection("category", value as EditableChangeFilters["category"])}
            >
              <SelectTrigger className="h-9 w-full" aria-label="Category">
                <SelectValue>{selectedCategoryLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">All categories</SelectItem>
                  {categoryOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          {hasFilters ? (
            <Field orientation="horizontal">
              <Button type="button" variant="ghost" onClick={clearFilters}>Clear filters</Button>
            </Field>
          ) : null}
    </FieldGroup>
  );

  if (!surface) {
    return (
      <div aria-busy={isPending} data-pending={isPending} className="w-full data-[pending=true]:opacity-80 sm:w-auto">
        {controls}
      </div>
    );
  }

  return (
    <Card size="sm" aria-busy={isPending} data-pending={isPending} className="data-[pending=true]:opacity-80">
      <CardContent>
        {controls}
      </CardContent>
    </Card>
  );
}
