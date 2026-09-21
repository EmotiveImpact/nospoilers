import type {ReactNode} from 'react';
import {DialogBackdrop,DialogPanel} from '@headlessui/react';

/** Presentation inside a caller-owned Dialog; selection and navigation stay with the caller. */
export function QuietSidePreview({children,inset=false}:{children:ReactNode;inset?:boolean}){
 return <><DialogBackdrop className={inset?'fixed inset-0 bg-black/60 backdrop-blur-sm':'fixed inset-0 bg-black/55 transition-opacity duration-150 data-closed:opacity-0 motion-reduce:transition-none'}/><div className={`fixed inset-0 flex justify-end${inset?' p-3':''}`}><DialogPanel className={inset?'overview-evidence-drawer':'h-full w-full max-w-lg overflow-y-auto border-l border-white/10 bg-[#111113] p-6 shadow-2xl transition duration-150 data-closed:translate-x-full motion-reduce:transition-none'}>{children}</DialogPanel></div></>;
}
