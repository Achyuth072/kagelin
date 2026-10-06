// Radix Select ignores change events in jsdom.
import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";

type TriggerProps = { children?: ReactNode; "aria-label"?: string };

export const SelectTrigger = (_: TriggerProps) => null;

export const SelectValue = () => null;

export const SelectItem = ({
  value,
  children,
}: {
  value: string;
  children: ReactNode;
}) => <option value={value}>{children}</option>;

export const SelectContent = ({ children }: { children?: ReactNode }) => (
  <>
    {Children.toArray(children).filter(
      (c) => isValidElement(c) && c.type === SelectItem,
    )}
  </>
);

export const Select = ({
  value,
  onValueChange,
  disabled,
  children,
}: {
  value: string;
  onValueChange: (v: string) => void;
  disabled?: boolean;
  children: ReactNode;
}) => {
  const trigger = Children.toArray(children).find(
    (c): c is ReactElement<TriggerProps> =>
      isValidElement(c) && c.type === SelectTrigger,
  );
  return (
    <select
      aria-label={trigger?.props["aria-label"]}
      value={value}
      disabled={disabled}
      onChange={(e) => onValueChange(e.target.value)}
    >
      {children}
    </select>
  );
};
