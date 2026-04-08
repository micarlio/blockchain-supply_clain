import clsx from "clsx"

export function cx(...classes: Array<string | false | null | undefined>) {
  return clsx(classes)
}
