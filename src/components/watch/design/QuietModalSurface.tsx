import type {ReactNode} from 'react';
import {DialogBackdrop,DialogPanel} from '@headlessui/react';

/** Use inside Dialog; Headless UI retains focus and dismissal ownership. */
export function QuietModalSurface({children}:{children:ReactNode}){
 return <><DialogBackdrop className="fixed inset-0 bg-black/70 transition-opacity duration-150 data-closed:opacity-0 motion-reduce:transition-none"/><div className="fixed inset-0 grid place-items-center overflow-y-auto px-4 py-8"><DialogPanel className="w-full max-w-xl rounded-xl border border-white/15 bg-panel p-5 shadow-2xl transition duration-150 data-closed:scale-95 data-closed:opacity-0 motion-reduce:transition-none">{children}</DialogPanel></div></>;
}
