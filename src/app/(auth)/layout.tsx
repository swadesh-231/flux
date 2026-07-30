import Header from "@/components/base/Header";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Header />
      <main className="flex flex-1 items-center justify-center px-6 pb-16 pt-22">
        {children}
      </main>
    </>
  );
}
