"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function ChoiceSelect({
  value,
  onChange,
  placeholder,
  options,
  id,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  options: { value: string; label: string }[]
  id?: string
}) {
  return (
    <Select
      value={value || null}
      onValueChange={(next) => {
        if (next) onChange(next)
      }}
      items={options}
    >
      <SelectTrigger id={id} className="w-full max-w-full !h-11 overflow-hidden">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
