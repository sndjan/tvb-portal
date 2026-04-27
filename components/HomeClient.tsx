"use client";

import { LogOut } from "lucide-react";

import { LoginForm } from "@/components/LoginForm";
import { MailingList } from "@/components/MailingList";
import { NewEntryForm } from "@/components/NewEntryForm";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskStatus } from "@/lib/types";
import { TaskCards } from "./TaskCards";
import { useHomeClient } from "./useHomeClient";
import { Spinner } from "./ui/spinner";

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed bg-card px-4 py-10 text-center">
      <p className="text-sm text-muted-foreground">
        Aktuell keine Arbeitseinsätze
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-3">
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}

export function HomeClient() {
  const {
    activeTab,
    setActiveTab,
    isAdmin,
    isLoadingTasks,
    loginPassword,
    setLoginPassword,
    isLoggingIn,
    isLoggingOut,
    createForm,
    setCreateForm,
    isCreatingTask,
    editingTaskId,
    editForm,
    setEditForm,
    busyTaskIds,
    emailRecipients,
    isLoadingEmailRecipients,
    emailInput,
    setEmailInput,
    pendingUploads,
    openTasks,
    doneTasks,
    listedTasks,
    refreshTasks,
    handleLoginSubmit,
    handleLogout,
    handleCreateTask,
    startEditTask,
    handleSaveEdit,
    handleDeleteTask,
    toggleTaskStatus,
    toggleTaskVisibility,
    updateUploadSelection,
    handleUploadImages,
    handleDeleteImage,
    handleAddEmailRecipient,
    handleRemoveEmailRecipient,
    onCancelEdit,
  } = useHomeClient();

  return (
    <main className="min-h-screen bg-linear-to-b from-background via-background to-muted/40 pb-14">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pt-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-2xl border bg-card/70 p-5 backdrop-blur-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                TV Bellenberg
              </h1>
              <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                Arbeitseinsätze
              </p>
            </div>

            {isAdmin ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? (
                  <Spinner />
                ) : (
                  <LogOut className="size-4" aria-hidden="true" />
                )}
                Logout
              </Button>
            ) : null}

            {!isAdmin ? (
              <LoginForm
                loginPassword={loginPassword}
                setLoginPassword={setLoginPassword}
                isLoggingIn={isLoggingIn}
                handleLoginSubmit={handleLoginSubmit}
              />
            ) : null}
          </div>
        </header>

        {isAdmin ? (
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <NewEntryForm
              handleCreateTask={handleCreateTask}
              createForm={createForm}
              setCreateForm={setCreateForm}
              isCreatingTask={isCreatingTask}
            />

            <MailingList
              emailInput={emailInput}
              setEmailInput={setEmailInput}
              emailRecipients={emailRecipients}
              isLoadingEmailRecipients={isLoadingEmailRecipients}
              handleAddEmailRecipient={handleAddEmailRecipient}
              handleRemoveEmailRecipient={handleRemoveEmailRecipient}
            />
          </div>
        ) : null}

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as TaskStatus)}
          className="w-full gap-4"
        >
          <TabsList>
            <TabsTrigger value="open">Offen ({openTasks.length})</TabsTrigger>
            <TabsTrigger value="done">
              Erledigt ({doneTasks.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="open" className="mt-0">
            {isLoadingTasks ? (
              <LoadingState />
            ) : listedTasks.length === 0 ? (
              <EmptyState />
            ) : (
              <TaskCards
                tasks={listedTasks}
                isAdmin={isAdmin}
                editingTaskId={editingTaskId}
                editForm={editForm}
                busyTaskIds={busyTaskIds}
                pendingUploads={pendingUploads}
                onParticipantsChanged={() =>
                  refreshTasks({ keepLoadingState: true })
                }
                onStartEdit={startEditTask}
                onCancelEdit={onCancelEdit}
                onChangeEditForm={setEditForm}
                onSaveEdit={handleSaveEdit}
                onDeleteTask={handleDeleteTask}
                onToggleStatus={toggleTaskStatus}
                onToggleVisibility={toggleTaskVisibility}
                onSelectUpload={updateUploadSelection}
                onUploadImages={handleUploadImages}
                onDeleteImage={handleDeleteImage}
              />
            )}
          </TabsContent>

          <TabsContent value="done" className="mt-0">
            {isLoadingTasks ? (
              <LoadingState />
            ) : listedTasks.length === 0 ? (
              <EmptyState />
            ) : (
              <TaskCards
                tasks={listedTasks}
                isAdmin={isAdmin}
                editingTaskId={editingTaskId}
                editForm={editForm}
                busyTaskIds={busyTaskIds}
                pendingUploads={pendingUploads}
                onParticipantsChanged={() =>
                  refreshTasks({ keepLoadingState: true })
                }
                onStartEdit={startEditTask}
                onCancelEdit={onCancelEdit}
                onChangeEditForm={setEditForm}
                onSaveEdit={handleSaveEdit}
                onDeleteTask={handleDeleteTask}
                onToggleStatus={toggleTaskStatus}
                onToggleVisibility={toggleTaskVisibility}
                onSelectUpload={updateUploadSelection}
                onUploadImages={handleUploadImages}
                onDeleteImage={handleDeleteImage}
              />
            )}
          </TabsContent>
        </Tabs>
      </section>
    </main>
  );
}
