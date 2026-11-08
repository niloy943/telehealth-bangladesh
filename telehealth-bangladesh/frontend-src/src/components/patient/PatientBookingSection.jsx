import React from 'react';
import {
  Search, X, Sparkles, Stethoscope, Calendar
} from 'lucide-react';
import {
  Button, Card, CardHeader, CardTitle, CardDescription, CardContent,
  VerifiedBadge, EmptyState, PageHeader
} from '../ui';

export const PatientBookingSection = ({
  searchTerm,
  setSearchTerm,
  specialtyFilter,
  setSpecialtyFilter,
  filteredDoctors,
  setBookingModalDoc,
  setSelectedDocId,
  setSubView
}) => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Find a Verified Doctor"
        action={
          <Button variant="outline" size="sm" onClick={() => setSubView('overview')}>
            Back to Health Home
          </Button>
        }
      />

      {/* Search & Specialty Suggestion Filter Controls */}
      <div className="space-y-3">
        {/* Search Bar on Top */}
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-[#4B5563]" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by doctor name or medical department..."
            className="w-full pl-11 pr-10 py-3 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none border border-transparent focus:border-[#BDDDFA] transition-all"
            style={{ paddingLeft: '2.75rem' }}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#55647C] hover:text-[#0F172A]"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Recommendation & Suggestion Bar Under the Search Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[#55647C] flex items-center gap-1.5 mr-1">
            <Sparkles className="w-3.5 h-3.5 text-[#168CF5]" />
            Departments:
          </span>
          <div className="bg-[#E7F0FC] p-1 rounded-xl flex items-center gap-1 border border-[#BDDDFA] overflow-x-auto max-w-full">
            {['all', 'Cardiology', 'Pediatrics', 'General Practice', 'ENT'].map(spec => {
              const isActive = specialtyFilter === spec;
              return (
                <button
                  key={spec}
                  onClick={() => setSpecialtyFilter(spec)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${isActive
                    ? 'bg-[#0F172A] text-white shadow-sm'
                    : 'text-[#55647C] hover:text-[#0F172A]'
                    }`}
                >
                  {spec === 'all' ? 'All Specialties' : spec}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Doctors Grid */}
      {filteredDoctors.length === 0 ? (
        <EmptyState
          icon={Stethoscope}
          title="No doctors match your query"
          description="Try adjusting your specialty filter or searching with a different doctor name."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDoctors.map(doc => (
            <Card key={doc.id} className="flex flex-col justify-between">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-[#E7F0FC] text-[#0F172A] font-bold flex items-center justify-center text-sm border border-[#BDDDFA]">
                    {doc.user?.first_name?.[0] || 'D'}
                  </div>
                  <VerifiedBadge text={` ${doc.bmdc_reg || 'Verified'}`} />
                </div>
                <CardTitle className="mt-3">
                  Dr. {doc.user?.first_name} {doc.user?.last_name}
                </CardTitle>
                <p className="text-xs font-semibold text-[#059669]">
                  {doc.specialty}
                </p>
                <CardDescription>{doc.hospital || 'Specialist Hospital'}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-xs p-3 rounded-xl bg-[#E7F0FC] border border-[#BDDDFA]">
                  <div>
                    <span className="text-[#55647C] block text-[10px] uppercase font-bold">Experience</span>
                    <span className="font-semibold text-[#0F172A]">{doc.experience || 1}+ Years</span>
                  </div>
                  <div>
                    <span className="text-[#55647C] block text-[10px] uppercase font-bold">Consultation Fee</span>
                    <span className="font-semibold text-[#059669]">৳{doc.fees || 500} BDT</span>
                  </div>
                </div>

                {/* Available Schedule */}
                <div className="p-3 rounded-xl bg-[#E7F0FC] border border-[#BDDDFA] space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#55647C] uppercase tracking-wider">
                    <Calendar className="w-3.5 h-3.5 text-[#168CF5]" />
                    <span>Available Schedule</span>
                  </div>
                  {Array.isArray(doc.schedule) && doc.schedule.length > 0 ? (
                    <div className="space-y-1">
                      {doc.schedule.map((slot, sIdx) => (
                        <div key={sIdx} className="flex items-center justify-between text-xs py-0.5 text-[#334155]">
                          <span className="font-medium text-[#0F172A]">{slot.day}</span>
                          <span className="font-mono text-[10px] text-[#059669] bg-white px-1.5 py-0.5 rounded border border-[#BDDDFA]">
                            {slot.start_time} – {slot.end_time}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#55647C] italic">Available on appointment</p>
                  )}
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setBookingModalDoc(doc);
                    setSelectedDocId(doc.user?.id || doc.id);
                  }}
                  className="w-full"
                >
                  Book Consultation
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

